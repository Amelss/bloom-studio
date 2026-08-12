-- New flower varieties — 2026-08-11 (Chrysanthemum, Amaranthus, Pampas,
-- Scabiosa, String of Pearls, Veronica). Run in the Supabase SQL editor BEFORE
-- `npm run assets:add` (add-asset requires the variety to already exist).
-- Colourways + asset rows are created by add-asset; this only seeds the varieties.
--
-- REVIEW before running: guide_price_gbp are per-stem UK-wholesale GUIDE
-- estimates, calibrated against the existing catalog — NOT scraped live prices.
-- Replace with your wholesaler's actual per-stem trade prices before running.
-- (seasons are proposed too.) width_mm must match SPREAD_MM in
-- scripts/import-cutout.mjs (already updated to match these).

insert into public.varieties
  (id, common_name, botanical_name, category, guide_price_gbp, seasons, stem_length_cm, width_mm, fragility, education, sort)
values
  ('chrysanthemum', 'Chrysanthemum', 'Chrysanthemum morifolium', 'focal', 0.80,
   ARRAY['year-round'], 60, 95, 'low',
   $${"role":"A long-lasting round focal — dense, layered petals form a full dome that reads as a bold, structured bloom and holds its shape for weeks.","conditioning":"One of the hardiest cut flowers: re-cut, strip the lower foliage, and it will outlast almost everything else in the arrangement.","designTip":"Its perfect dome can look static — set it at varied depths and pair with looser textures so it grounds the design without flattening it."}$$::jsonb, 100),

  ('amaranthus', 'Green Amaranthus', 'Amaranthus viridis', 'line', 1.30,
   ARRAY['summer','autumn'], 60, 110, 'low',
   $${"role":"A trailing textural line — long, tassel-like ropes of tiny florets add movement, drape and a wild, garden-gathered feel.","conditioning":"Woody-stemmed and thirsty; give it a deep drink and it lasts well. The tassels shed a little — condition over a bin.","designTip":"Let it spill over the edge of a bouquet or arch to break a tight outline; a few strands do a lot."}$$::jsonb, 101),

  ('pampas', 'Pampas Grass', 'Cortaderia selloana', 'line', 2.80,
   ARRAY['year-round'], 90, 130, 'low',
   $${"role":"A soft, feathery statement plume — dried and airy, it brings height, neutral colour and a bohemian, textural softness.","conditioning":"Dried, so no water needed; a light mist of hairspray reduces shedding. Handle gently — the plumes bruise and fluff.","designTip":"Use sparingly for scale and negative space; one or two plumes read as intentional, a bunch reads as a broom."}$$::jsonb, 102),

  ('scabiosa', 'Scabiosa', 'Scabiosa atropurpurea', 'secondary', 0.90,
   ARRAY['summer','autumn'], 45, 65, 'high',
   $${"role":"A delicate domed secondary — a pincushion of tiny florets on a wiry stem that adds airy detail and a cottage-garden charm.","conditioning":"Thin, wiry stems drink fast — keep the water topped up. The blooms are fragile; handle by the stem.","designTip":"Float it on longer stems above the mass so the heads bob and add lightness and movement."}$$::jsonb, 103),

  ('string-of-pearls', 'String of Pearls', 'Senecio rowleyanus', 'foliage', 2.00,
   ARRAY['year-round'], 40, 45, 'low',
   $${"role":"A trailing succulent — strands of round, bead-like leaves cascade downward, adding a modern, sculptural line of green.","conditioning":"Succulent and forgiving out of water for short spells; mist lightly. The strands snap, so drape rather than bend them.","designTip":"Reserve it for the trailing edge of a bouquet or an elevated arrangement where it can hang and catch the light."}$$::jsonb, 104),

  ('veronica', 'Veronica', 'Veronica spicata', 'line', 0.85,
   ARRAY['summer','autumn'], 60, 45, 'medium',
   $${"role":"A slender line flower — a tapering spike of tiny florets that opens from the base up, giving height, rhythm and a soft vertical accent.","conditioning":"Keep the water clean and re-cut; strip the lower leaves. The spikes keep growing and curving toward light — store upright.","designTip":"Place the spikes early to set the height and let them lean naturally; they draw the eye upward and outward."}$$::jsonb, 105)
on conflict (id) do nothing;
