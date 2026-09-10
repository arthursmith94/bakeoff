//! Bakeoff — an on-chain cookie clicker for Cookie Chain.
//!
//! Every batch of clicks is a real transaction. Oven upgrades are paid in COOK
//! and sent straight to the community Cookie Jar (multisig Vault 1), so playing
//! funds Cookie Chain builders. No admin keys, no token, just cookies.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("6GcyLhDfzZBHNpkiBaiWQbXamVoaGK9dcMxHh5DtcjQB");

/// Cookie Jar — community multisig Vault 1 (docs.cookiechain.wtf/cookie-jar).
pub const COOKIE_JAR: Pubkey = pubkey!("568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe");

pub const MAX_BAKES_PER_TX: u8 = 25;
pub const MAX_OVEN_LEVEL: u8 = 12;
/// Level 1 upgrade costs 0.05 COOK; each level doubles. Level 12 ≈ 102 COOK.
pub const BASE_UPGRADE_LAMPORTS: u64 = 50_000_000;

/// Cookies per click at each oven level (index = level).
pub const MULTIPLIERS: [u16; 13] = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];

pub fn upgrade_cost(current_level: u8) -> u64 {
    BASE_UPGRADE_LAMPORTS << (current_level as u64)
}

#[program]
pub mod bakeoff {
    use super::*;

    /// Create the global stats account. Anyone can call once.
    pub fn init_global(ctx: Context<InitGlobal>) -> Result<()> {
        let g = &mut ctx.accounts.global;
        g.total_bakes = 0;
        g.total_cookies = 0;
        g.total_players = 0;
        g.total_jar_lamports = 0;
        g.bump = ctx.bumps.global;
        Ok(())
    }

    /// Create a player account for the signer.
    pub fn init_player(ctx: Context<InitPlayer>) -> Result<()> {
        let p = &mut ctx.accounts.player;
        p.owner = ctx.accounts.owner.key();
        p.cookies = 0;
        p.bakes = 0;
        p.oven_level = 0;
        p.multiplier = MULTIPLIERS[0];
        p.created_slot = Clock::get()?.slot;
        p.last_slot = p.created_slot;
        p.bump = ctx.bumps.player;
        ctx.accounts.global.total_players = ctx.accounts.global.total_players.saturating_add(1);
        emit!(PlayerCreated { owner: p.owner, slot: p.created_slot });
        Ok(())
    }

    /// Bake `n` cookies (1..=25 clicks batched into one tx).
    pub fn bake(ctx: Context<Bake>, n: u8) -> Result<()> {
        require!(n >= 1 && n <= MAX_BAKES_PER_TX, BakeoffError::InvalidBakeCount);
        let p = &mut ctx.accounts.player;
        let g = &mut ctx.accounts.global;
        let minted = (n as u64) * (p.multiplier as u64);
        p.cookies = p.cookies.saturating_add(minted);
        p.bakes = p.bakes.saturating_add(n as u64);
        p.last_slot = Clock::get()?.slot;
        g.total_bakes = g.total_bakes.saturating_add(n as u64);
        g.total_cookies = g.total_cookies.saturating_add(minted);
        emit!(Baked { owner: p.owner, n, minted, cookies: p.cookies, slot: p.last_slot });
        Ok(())
    }

    /// Upgrade the oven. Cost (in COOK lamports) is transferred to the Cookie Jar.
    pub fn upgrade_oven(ctx: Context<UpgradeOven>) -> Result<()> {
        let level = ctx.accounts.player.oven_level;
        require!(level < MAX_OVEN_LEVEL, BakeoffError::MaxLevel);
        let cost = upgrade_cost(level);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.cookie_jar.to_account_info(),
                },
            ),
            cost,
        )?;

        let p = &mut ctx.accounts.player;
        p.oven_level = level + 1;
        p.multiplier = MULTIPLIERS[p.oven_level as usize];
        let g = &mut ctx.accounts.global;
        g.total_jar_lamports = g.total_jar_lamports.saturating_add(cost);
        emit!(OvenUpgraded { owner: p.owner, level: p.oven_level, multiplier: p.multiplier, paid: cost });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitGlobal<'info> {
    #[account(init, payer = payer, space = 8 + Global::INIT_SPACE, seeds = [b"global"], bump)]
    pub global: Account<'info, Global>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitPlayer<'info> {
    #[account(init, payer = owner, space = 8 + Player::INIT_SPACE, seeds = [b"player", owner.key().as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [b"global"], bump = global.bump)]
    pub global: Account<'info, Global>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Bake<'info> {
    #[account(mut, seeds = [b"player", owner.key().as_ref()], bump = player.bump, has_one = owner)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [b"global"], bump = global.bump)]
    pub global: Account<'info, Global>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpgradeOven<'info> {
    #[account(mut, seeds = [b"player", owner.key().as_ref()], bump = player.bump, has_one = owner)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [b"global"], bump = global.bump)]
    pub global: Account<'info, Global>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: hard-coded community Cookie Jar vault; only receives lamports.
    #[account(mut, address = COOKIE_JAR @ BakeoffError::WrongJar)]
    pub cookie_jar: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Global {
    pub total_bakes: u64,
    pub total_cookies: u64,
    pub total_players: u64,
    pub total_jar_lamports: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Player {
    pub owner: Pubkey,
    pub cookies: u64,
    pub bakes: u64,
    pub oven_level: u8,
    pub multiplier: u16,
    pub created_slot: u64,
    pub last_slot: u64,
    pub bump: u8,
}

#[event]
pub struct PlayerCreated { pub owner: Pubkey, pub slot: u64 }
#[event]
pub struct Baked { pub owner: Pubkey, pub n: u8, pub minted: u64, pub cookies: u64, pub slot: u64 }
#[event]
pub struct OvenUpgraded { pub owner: Pubkey, pub level: u8, pub multiplier: u16, pub paid: u64 }

#[error_code]
pub enum BakeoffError {
    #[msg("bake count must be between 1 and 25")]
    InvalidBakeCount,
    #[msg("oven is already at max level")]
    MaxLevel,
    #[msg("cookie_jar must be the community Cookie Jar vault")]
    WrongJar,
}
