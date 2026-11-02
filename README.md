<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1T6iqCAh6b9c7ot4ypSIfJhE1ZSOioNsH

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Controls

`←` `→` move, `Up` / `W` jump, `Shift` / `X` run and throw, `M` mute.

## Power-ups

`?` blocks hand out items. You can only carry one power-up at a time - picking
up another one replaces it, and taking a hit makes you drop it.

| Item | Effect |
| --- | --- |
| Mushroom | Grow into the big form |
| Fire flower | Fire form - shoot fireballs with `X` |
| Ice flower | Ice form - shoot iceballs that freeze enemies |
| Star | 10s of invincibility, everything you touch dies |
| 1-UP | An extra heart |
| Tanooki suit | One extra mid-air jump |
| Boomerang flower | `X` throws a boomerang that flattens enemies and comes back |
| Jetpack | Hold `Up` to fly, the tank refills when you let go |
| Magnet | Drags nearby coins and items towards you (14s) |
| Hourglass | Slow motion: enemies crawl and points double (10s) |
| Spring | Higher jumps, and hard landings bounce you back up (15s) |
| Gold mushroom | Bursts into a shower of coins |
| Mega mushroom | 8s mega form: bigger, shrugs off hits, smashes bricks |

Coins are worth 100 points each and every 100 coins buys a free life. Chaining
airborne stomps pays out more and more (100 up to 8000) and the last link of the
chain turns into a 1-UP.
