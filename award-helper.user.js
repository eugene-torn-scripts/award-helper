// ==UserScript==
// @name         Award Helper
// @namespace    https://github.com/eugene-torn-scripts/award-helper
// @version      1.0.1
// @description  Torn award reminders on the attack page: which weapon to finish with, armor off for Bare, special ammo, abroad wins, target bounties, daily refills, plus a progress panel. Desktop + Torn PDA.
// @author       lannav
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.torn.com
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/eugene-torn-scripts/award-helper
// @downloadURL  https://raw.githubusercontent.com/eugene-torn-scripts/award-helper/main/award-helper.user.js
// @updateURL    https://raw.githubusercontent.com/eugene-torn-scripts/award-helper/main/award-helper.user.js
// ==/UserScript==

/*
 * Award Helper
 * Copyright (C) 2026 lannav
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details: https://www.gnu.org/licenses/gpl-3.0.html
 *
 * Source: https://github.com/eugene-torn-scripts/award-helper
 */

/* eslint-disable no-undef */

(function () {
    "use strict";

    const VERSION = "1.0.1";
    const PDA_API_KEY = "###PDA-APIKEY###";
    const PDA_PLACEHOLDER = "###" + "PDA-APIKEY" + "###";
    const IS_PDA = typeof PDA_httpGet === "function";
    const HAS_PDA_KEY = PDA_API_KEY !== PDA_PLACEHOLDER && /^[A-Za-z0-9]{16}$/.test(PDA_API_KEY);
    const GM_XHR = (typeof GM_xmlhttpRequest !== "undefined") ? GM_xmlhttpRequest : null;
    const PAGE = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;

    const LS = {
        apiKey: "ah_apiKey",
        settings: "ah_settings",
        collapsed: "ah_collapsed",
        cachePrefix: "ah_cache_",
        dismissPrefix: "ah_dismiss_",
    };

    const MIN = 60_000;
    const HOUR = 60 * MIN;

    const DEFAULT_SETTINGS = { weapon: true, armor: true, ammo: true, abroad: true, bounty: true, refill: true };
    const SETTING_LABELS = {
        weapon: "Weapon for finishing hits",
        armor: "Armor warning (Bare)",
        ammo: "Special ammo + Dragon's Breath",
        abroad: "Wins abroad (International)",
        bounty: "Target bounty (bounty awards)",
        refill: "Daily refill reminder (all pages)",
    };

    const FINISH = [
        { key: "heavy_artillery", label: "Heavy artillery", honor: 141, name: "Stumped" },
        { key: "machine_guns", label: "Machine guns", honor: 144, name: "Lend A Hand" },
        { key: "rifles", label: "Rifles", honor: 146, name: "2800 Ft/S" },
        { key: "sub_machine_guns", label: "SMGs", honor: 148, name: "Act Of Faith" },
        { key: "shotguns", label: "Shotguns", honor: 147, name: "Cartridge Packer" },
        { key: "pistols", label: "Pistols", honor: 145, name: "Yours Says Replica" },
        { key: "temporary", label: "Temporary", honor: 143, name: "Pin Puller" },
        { key: "piercing", label: "Piercing", honor: 149, name: "The Stabbist" },
        { key: "slashing", label: "Slashing", honor: 150, name: "Slasher" },
        { key: "clubbing", label: "Clubbing", honor: 142, name: "Axe Wound" },
        { key: "mechanical", label: "Mechanical", honor: 28, name: "Machinist" },
        { key: "hand_to_hand", label: "Fists / Kick", honor: 515, name: "Unarmed" },
    ];

    const SUB_TYPE_KEY = {
        "Heavy artillery": "heavy_artillery",
        "Machine gun": "machine_guns",
        "Rifle": "rifles",
        "SMG": "sub_machine_guns",
        "Shotgun": "shotguns",
        "Pistol": "pistols",
        "Temporary": "temporary",
        "Piercing": "piercing",
        "Slashing": "slashing",
        "Clubbing": "clubbing",
        "Mechanical": "mechanical",
    };

    const SLOT_NAME = { 1: "Primary", 2: "Secondary", 3: "Melee", 5: "Temporary", fists: "Fists", kick: "Kick" };
    const SLOT_SELECTORS = {
        1: ["#attacker_Primary", "#weapon_main"],
        2: ["#attacker_Secondary", "#weapon_second"],
        3: ["#attacker_Melee", "#weapon_melee"],
        5: ["#attacker_Temporary", "#weapon_temp"],
        fists: ["#attacker_Fists", "#weapon_fists"],
        kick: ["#attacker_Kick", "#attacker_Boots", "#weapon_boots"],
    };

    const AMMO_TYPES = {
        "Hollow Point": { key: "hollow_point", honor: 942, target: 2500, name: "Maimed" },
        "Piercing": { key: "piercing", honor: 943, target: 2500, name: "Penetrated" },
        "Incendiary": { key: "incendiary", honor: 944, target: 2500, name: "Scorched" },
        "Tracer": { key: "tracer", honor: 945, target: 2500, name: "Marked" },
    };
    const SPECIAL_TIERS = [
        { honor: 800, target: 100, name: "Surplus" },
        { honor: 793, target: 1000, name: "Bandolier" },
        { honor: 791, target: 10000, name: "Quartermaster" },
    ];
    const BOUNTY_TIERS = [
        { medal: 202, target: 100, name: "Bone Collector" },
        { honor: 232, target: 250, name: "Bounty Hunter" },
        { medal: 203, target: 500, name: "The Fett" },
    ];
    const AW = {
        bare: { honor: 763, target: 250, name: "Bare" },
        international: { honor: 846, target: 100, name: "International" },
        leonidas: { honor: 871, name: "Leonidas" },
        dragon: { honor: 951, name: "Dragon's Breath" },
        warMachine: { honor: 611, target: 1000, name: "War Machine" },
        sidekick: { honor: 490, target: 250, name: "Sidekick" },
        blitz: { medal: 193, target: 250, name: "Blitzkrieg" },
        deadOrAlive: { honor: 236, target: 10_000_000, name: "Dead Or Alive" },
        energize: { honor: 266, target: 250, name: "Energize" },
        nerve: { honor: 566, target: 250, name: "You've Got Some Nerve" },
    };

    function lsGet(k) {
        try { return localStorage.getItem(k); } catch { return null; }
    }
    function lsSet(k, v) {
        try { localStorage.setItem(k, v); return true; } catch { return false; }
    }
    function lsDel(k) {
        try { localStorage.removeItem(k); return true; } catch { return false; }
    }
    function readJson(k) {
        const raw = lsGet(k);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    }
    function writeJson(k, v) { return lsSet(k, JSON.stringify(v)); }

    const num = (v) => Number(v) || 0;
    const fmtN = (n) => num(n).toLocaleString("en-US");
    const money = (n) => "$" + fmtN(Math.round(num(n)));
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
    const utcDay = () => new Date().toISOString().slice(0, 10);

    function dig(obj, path) {
        return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    }

    const Settings = {
        get() { return { ...DEFAULT_SETTINGS, ...(readJson(LS.settings) || {}) }; },
        set(next) { writeJson(LS.settings, next); },
    };

    function withTimeout(p, ms) {
        return Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
    }

    function gmGet(url) {
        return new Promise((resolve, reject) => {
            GM_XHR({
                method: "GET",
                url,
                timeout: 20_000,
                onload: (r) => resolve({ status: r.status, text: r.responseText }),
                onerror: () => reject(new Error("network_error")),
                ontimeout: () => reject(new Error("timeout")),
            });
        });
    }

    async function httpGetJson(url) {
        let status;
        let text;
        if (IS_PDA) {
            const r = await withTimeout(PDA_httpGet(url), 20_000);
            status = r.status;
            text = r.responseText;
        } else if (GM_XHR) {
            const r = await gmGet(url);
            status = r.status;
            text = r.text;
        } else {
            const r = await fetch(url);
            status = r.status;
            text = await r.text();
        }
        if (status < 200 || status >= 300) {
            const err = new Error(`HTTP ${status}`);
            err.status = status;
            throw err;
        }
        return JSON.parse(text);
    }

    const Api = {
        inflight: new Map(),
        key() {
            if (HAS_PDA_KEY) return PDA_API_KEY;
            return lsGet(LS.apiKey) || "";
        },
        async get(path, ttl) {
            const key = this.key();
            if (!key) {
                const err = new Error("no_key");
                err.code = "no_key";
                throw err;
            }
            const cacheKey = LS.cachePrefix + path;
            const cached = readJson(cacheKey);
            if (cached && Date.now() - cached.at < ttl) return cached.data;
            if (this.inflight.has(path)) return this.inflight.get(path);
            const sep = path.includes("?") ? "&" : "?";
            const p = httpGetJson(`https://api.torn.com/v2${path}${sep}key=${encodeURIComponent(key)}`)
                .then((data) => {
                    if (data && data.error) {
                        const err = new Error(data.error.error || "api_error");
                        err.code = data.error.code;
                        throw err;
                    }
                    writeJson(cacheKey, { at: Date.now(), data });
                    return data;
                })
                .finally(() => this.inflight.delete(path));
            this.inflight.set(path, p);
            return p;
        },
        clearCache() {
            const drop = [];
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(LS.cachePrefix)) drop.push(k);
                }
            } catch {
                return;
            }
            drop.forEach(lsDel);
        },
    };

    function errText(e) {
        if (!e) return "Unknown error";
        if (e.code === "no_key") return "Set your Torn API key: footer menu → Award Helper.";
        if (e.code === 2) return "Incorrect API key. Check it in the Award Helper panel.";
        if (e.code === 16) return "Key access level too low. Use a Minimal or higher access key.";
        if (e.code === 5) return "Too many API requests. Try again in a minute.";
        return e.message || String(e);
    }

    async function loadCore(statsTtl) {
        const [h, m, s] = await Promise.all([
            Api.get("/user/honors", HOUR),
            Api.get("/user/medals", HOUR),
            Api.get("/user/personalstats?cat=all", statsTtl),
        ]);
        const honors = new Set((h.honors || []).map((x) => x.id));
        const medals = new Set((m.medals || []).map((x) => x.id));
        return {
            ps: s.personalstats || {},
            has(a) { return a.honor ? honors.has(a.honor) : medals.has(a.medal); },
            done(a, count) { return this.has(a) || (a.target != null && num(count) >= a.target); },
        };
    }

    function finishGoal(ctx, cat) {
        const count = num(dig(ctx.ps, `finishing_hits.${cat.key}`));
        if (!ctx.done({ honor: cat.honor, target: 100 }, count)) {
            return { tier: 1, count, target: 100, name: cat.name, label: cat.label };
        }
        if (!ctx.done(AW.warMachine, count)) {
            return { tier: 2, count, target: 1000, name: AW.warMachine.name, label: cat.label };
        }
        return null;
    }

    function nextTier(ctx, tiers, count) {
        return tiers.find((t) => !ctx.done(t, count)) || null;
    }

    function goalText(g) {
        if (g.tier === 0) return `<b>${esc(g.name)}</b> (first kick finish)`;
        return `${esc(g.name)} ${fmtN(g.count)}/${fmtN(g.target)}`;
    }

    function attackerArea() {
        return document.querySelector("[class*=weaponList]");
    }

    function kickAvailable() {
        const area = attackerArea();
        return !!(area && area.querySelector("#weapon_boots, #attacker_Kick, #attacker_Boots"));
    }

    function waitFor(fn, ms) {
        return new Promise((resolve) => {
            const t0 = Date.now();
            const tick = () => {
                const v = fn();
                if (v || Date.now() - t0 > ms) return resolve(v);
                setTimeout(tick, 200);
                return undefined;
            };
            tick();
        });
    }

    function weaponOptions(ctx, equipment, hasKick) {
        const leonidasOpen = !ctx.has(AW.leonidas);
        const opts = [];
        for (const it of equipment) {
            if (it.type !== "Weapon" || !SLOT_SELECTORS[it.slot]) continue;
            const key = SUB_TYPE_KEY[it.sub_type];
            if (key) opts.push({ slots: [it.slot], label: `${SLOT_NAME[it.slot]}: ${it.name}`, key, weapon: true });
        }
        if (leonidasOpen && hasKick) {
            opts.push({ slots: ["kick"], label: "Kick", key: "hand_to_hand", kick: true });
            opts.push({ slots: ["fists"], label: "Fists", key: "hand_to_hand" });
        } else if (hasKick) {
            opts.push({ slots: ["fists", "kick"], label: "Fists or Kick", key: "hand_to_hand" });
        } else {
            opts.push({ slots: ["fists"], label: "Fists", key: "hand_to_hand" });
        }
        for (const o of opts) {
            const cat = FINISH.find((f) => f.key === o.key);
            o.goals = [];
            if (o.kick) o.goals.push({ tier: 0, count: 0, target: 1, name: AW.leonidas.name });
            const g = finishGoal(ctx, cat);
            if (g) o.goals.push(g);
            o.rank = o.goals.length ? Math.min(...o.goals.map((x) => x.tier * 1e7 + (x.target - x.count))) : Infinity;
        }
        return opts;
    }

    function specialOwned(ammoList, ammoId) {
        const entry = (ammoList || []).find((a) => a.id === ammoId);
        if (!entry) return [];
        return (entry.types || []).filter((t) => AMMO_TYPES[t.name] && num(t.quantity) > 0);
    }

    function buildLines(ctx, data, settings) {
        const lines = [];
        const highlights = [];
        const eq = data.equipment;

        if (settings.weapon && eq) {
            const opts = weaponOptions(ctx, eq, data.hasKick);
            const useful = opts.filter((o) => o.goals.length).sort((a, b) => a.rank - b.rank);
            const isMain = (o) => o.goals.some((g) => g.tier <= 1);
            if (useful.length) {
                const [top, ...rest] = useful;
                lines.push({ level: "ok", html: `🎯 Finish with <b>${esc(top.label)}</b>: ${top.goals.map(goalText).join(" · ")}` });
                if (isMain(top)) highlights.push({ slots: top.slots, strength: "strong" });
                for (const o of rest.slice(0, 3)) {
                    lines.push({ level: "info", html: `Also: <b>${esc(o.label)}</b>: ${o.goals.map(goalText).join(" · ")}` });
                    if (isMain(o)) highlights.push({ slots: o.slots, strength: "soft" });
                }
            }
            if (!data.hasKick && !ctx.has(AW.leonidas)) {
                lines.push({ level: "info", html: "Leonidas needs a finishing hit with <b>Kick</b>. Your attack page has no Kick slot now." });
            }
            const weaponHelps = opts.some((o) => o.weapon && o.goals.some((g) => g.tier <= 1));
            if (!weaponHelps) {
                const open = FINISH.filter((c) => c.key !== "hand_to_hand")
                    .map((c) => finishGoal(ctx, c))
                    .filter((g) => g && g.tier === 1)
                    .sort((a, b) => (a.target - a.count) - (b.target - b.count));
                if (open.length) {
                    lines.push({
                        level: "warn",
                        html: `⚠ Your equipped weapons do not help an open finishing-hit award. Open: ${open.map((g) => `${esc(g.label)} ${fmtN(g.count)}/100`).join(", ")}`,
                    });
                }
            }
        }

        if (settings.armor && eq) {
            const wins = num(dig(ctx.ps, "attacking.unarmored_wins"));
            if (!ctx.done(AW.bare, wins)) {
                const armor = eq.filter((it) => it.type === "Armor");
                if (armor.length) {
                    lines.push({
                        level: "warn",
                        html: `⚠ You wear armor (${armor.length} ${armor.length === 1 ? "piece" : "pieces"}). Only wins without armor count for Bare: ${fmtN(wins)}/250. Take armor off for easy targets.`,
                    });
                } else {
                    lines.push({ level: "ok", html: `✓ No armor: a win counts for Bare ${fmtN(wins)}/250` });
                }
            }
        }

        if (settings.ammo && eq) {
            const special = num(dig(ctx.ps, "attacking.ammunition.special"));
            const tier = nextTier(ctx, SPECIAL_TIERS, special);
            const tierText = tier ? `${tier.name} ${fmtN(special)}/${fmtN(tier.target)}` : "";
            const guns = eq.filter((it) => it.type === "Weapon" && it.ammo && (it.slot === 1 || it.slot === 2));
            for (const gun of guns) {
                const where = `${SLOT_NAME[gun.slot]} ${esc(gun.name)}`;
                const loadedType = AMMO_TYPES[gun.ammo.type];
                if (loadedType) {
                    const used = num(dig(ctx.ps, `attacking.ammunition.${loadedType.key}`));
                    const parts = [];
                    if (tierText) parts.push(tierText);
                    if (!ctx.done(loadedType, used)) parts.push(`${loadedType.name} ${fmtN(used)}/2,500`);
                    if (parts.length) lines.push({ level: "ok", html: `✓ ${where} uses ${esc(gun.ammo.type)} ammo: ${parts.join(" · ")}` });
                    continue;
                }
                const owned = specialOwned(data.ammo, gun.ammo.id).map((t) => {
                    const info = AMMO_TYPES[t.name];
                    const used = num(dig(ctx.ps, `attacking.ammunition.${info.key}`));
                    return { name: t.name, quantity: num(t.quantity), info, used, open: !ctx.done(info, used) };
                });
                const anyOpen = tier || owned.some((t) => t.open);
                if (!anyOpen) continue;
                if (owned.length) {
                    owned.sort((a, b) => (Number(b.open) - Number(a.open)) || (b.quantity - a.quantity));
                    const best = owned[0];
                    const parts = [];
                    if (tierText) parts.push(tierText);
                    if (best.open) parts.push(`${best.info.name} ${fmtN(best.used)}/2,500`);
                    lines.push({
                        level: "warn",
                        html: `⚠ ${where} uses ${esc(gun.ammo.type)} ammo. Load <b>${esc(best.name)}</b> (${fmtN(best.quantity)} owned): ${parts.join(" · ")}`,
                    });
                } else if (tier) {
                    lines.push({ level: "info", html: `${where} uses ${esc(gun.ammo.type)} ammo. You have no special ${esc(gun.ammo.name)}. Buy some for ${tierText}.` });
                }
            }
            if (!ctx.has(AW.dragon)) {
                const shotgun = eq.find((it) => it.type === "Weapon" && it.sub_type === "Shotgun" && it.ammo);
                if (shotgun) {
                    if (shotgun.ammo.type === "Incendiary") {
                        lines.push({ level: "ok", html: `✓ ${esc(shotgun.name)} has Incendiary rounds: one shot gives <b>Dragon's Breath</b>` });
                    } else {
                        const inc = specialOwned(data.ammo, shotgun.ammo.id).find((t) => t.name === "Incendiary");
                        lines.push(inc
                            ? { level: "warn", html: `⚠ Load 12 Gauge Incendiary (${fmtN(inc.quantity)} owned) in ${esc(shotgun.name)}: one shot gives <b>Dragon's Breath</b>` }
                            : { level: "info", html: `Buy 12 Gauge Incendiary for ${esc(shotgun.name)}: one shot gives <b>Dragon's Breath</b>` });
                    }
                }
            }
        }

        if (settings.abroad && data.profile) {
            const won = num(dig(ctx.ps, "travel.attacks_won"));
            if (!ctx.done(AW.international, won) && dig(data.profile, "status.state") === "Abroad") {
                lines.push({ level: "ok", html: `✈ You are abroad: a win counts for International ${fmtN(won)}/100` });
            }
        }

        if (settings.bounty && data.bounties && data.bounties.length) {
            const count = num(dig(ctx.ps, "bounties.collected.amount"));
            const value = num(dig(ctx.ps, "bounties.collected.value"));
            const total = data.bounties.reduce((s, b) => s + num(b.reward) * Math.max(1, num(b.quantity)), 0);
            const n = data.bounties.reduce((s, b) => s + Math.max(1, num(b.quantity)), 0);
            const parts = [];
            const tier = nextTier(ctx, BOUNTY_TIERS, count);
            if (tier) parts.push(`${tier.name} ${fmtN(count)}/${fmtN(tier.target)}`);
            if (!ctx.done(AW.deadOrAlive, value)) parts.push(`Dead Or Alive ${money(value)}/$10M`);
            lines.unshift({
                level: "bounty",
                html: `💰 Target has ${n} ${n === 1 ? "bounty" : "bounties"} (${money(total)}). Win to collect${parts.length ? ": " + parts.join(" · ") : ""}`,
            });
        }

        return { lines, highlights };
    }

    function injectCSS() {
        if (document.getElementById("ah-style")) return;
        const style = document.createElement("style");
        style.id = "ah-style";
        style.textContent = `
#ah-banner{box-sizing:border-box;margin:6px 0 8px;padding:6px 10px;background:#1e1e1e;border:1px solid #3a3a3a;border-left:4px solid #c9a227;border-radius:6px;color:#ddd;font:12px/1.45 Arial,sans-serif}
#ah-banner.ah-fixed{position:fixed;top:70px;right:8px;max-width:340px;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,.5)}
#ah-banner .ah-head{display:flex;align-items:center;gap:6px;font-weight:700;color:#e0c25a}
#ah-banner .ah-head span{flex:1}
#ah-banner button{background:#333;color:#ddd;border:1px solid #555;border-radius:4px;padding:0 6px;cursor:pointer;font-size:12px;line-height:18px}
#ah-banner .ah-line{margin-top:4px;padding-left:6px;border-left:3px solid #607d8b}
#ah-banner .ah-ok{border-left-color:#4caf50}
#ah-banner .ah-warn{border-left-color:#ffb300;color:#ffd27a}
#ah-banner .ah-info{color:#bbb}\n#ah-banner .ah-bounty{border-left-color:#ffd54f;background:#3a2f0b;color:#ffe9a8;font-weight:700;padding:3px 6px;border-radius:4px}
#ah-banner.ah-collapsed .ah-lines{display:none}
[data-ah-hl="strong"]{outline:3px solid #4caf50!important;outline-offset:-3px}
[data-ah-hl="soft"]{outline:2px dashed #4caf50!important;outline-offset:-2px}
#ah-refill{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483645;background:#2a2410;border:1px solid #c9a227;color:#f3e3a6;border-radius:16px;padding:4px 6px 4px 12px;font:12px Arial,sans-serif;display:flex;gap:8px;align-items:center;box-shadow:0 2px 10px rgba(0,0,0,.5);max-width:calc(100vw - 16px);box-sizing:border-box}
#ah-refill a{color:#ffd54f;font-weight:700}
#ah-refill button{background:none;border:none;color:#ccc;cursor:pointer;font-size:14px;padding:0 4px}
#ah-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483646;display:flex;align-items:flex-start;justify-content:center;padding:40px 8px;overflow:auto;box-sizing:border-box}
#ah-panel{background:#1b1b1b;color:#ddd;border:1px solid #444;border-radius:8px;width:100%;max-width:560px;padding:12px 14px;font:13px/1.4 Arial,sans-serif;box-sizing:border-box}
#ah-panel h2{margin:0 0 8px;font-size:16px;color:#e0c25a;display:flex;align-items:baseline;flex-wrap:wrap}
#ah-panel h3{margin:14px 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.5px}
#ah-panel .ah-row{display:grid;grid-template-columns:1fr 90px 92px;gap:8px;align-items:center;padding:2px 0}
#ah-panel .ah-row .ah-n{text-align:right;font-variant-numeric:tabular-nums}
#ah-panel .ah-bar{height:6px;background:#333;border-radius:3px;overflow:hidden}
#ah-panel .ah-bar i{display:block;height:100%;background:#c9a227}
#ah-panel .ah-done{color:#4caf50}
#ah-panel .ah-hint{color:#888;font-size:11px}
#ah-panel input[type=text]{background:#111;color:#ddd;border:1px solid #555;border-radius:4px;padding:3px 6px;width:170px}
#ah-panel button{background:#333;color:#ddd;border:1px solid #555;border-radius:4px;padding:3px 10px;cursor:pointer;margin-left:4px}
#ah-panel label{display:block;padding:1px 0}
#ah-panel .ah-top{display:flex;justify-content:space-between;align-items:center}
`;
        document.head.appendChild(style);
    }

    const Banner = {
        el: null,
        build() {
            const el = document.createElement("div");
            el.id = "ah-banner";
            if (lsGet(LS.collapsed) === "1") el.classList.add("ah-collapsed");
            el.innerHTML = `<div class="ah-head"><span>🏅 Award Helper</span><button type="button" data-ah="refresh" title="Refresh">↻</button><button type="button" data-ah="collapse" title="Show / hide">–</button></div><div class="ah-lines"></div>`;
            el.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-ah]");
                if (!btn) return;
                e.preventDefault();
                if (btn.dataset.ah === "refresh") AttackPage.run(true);
                if (btn.dataset.ah === "collapse") {
                    const collapsed = el.classList.toggle("ah-collapsed");
                    lsSet(LS.collapsed, collapsed ? "1" : "0");
                }
            });
            this.el = el;
        },
        place() {
            if (!this.el) this.build();
            const root = document.getElementById("attack-root") || document.getElementById("react-root");
            if (root && root.parentNode) {
                if (this.el.nextSibling !== root) root.parentNode.insertBefore(this.el, root);
                this.el.classList.remove("ah-fixed");
            } else if (!this.el.isConnected) {
                this.el.classList.add("ah-fixed");
                document.body.appendChild(this.el);
            }
        },
        render(lines) {
            this.place();
            this.el.querySelector(".ah-lines").innerHTML = lines
                .map((l) => `<div class="ah-line ah-${l.level}">${l.html}</div>`)
                .join("");
        },
        remove() {
            if (this.el) this.el.remove();
        },
    };

    function clearHighlights() {
        document.querySelectorAll("[data-ah-hl]").forEach((el) => el.removeAttribute("data-ah-hl"));
    }

    function slotWrapper(slot) {
        const area = attackerArea();
        if (!area) return null;
        for (const sel of SLOT_SELECTORS[slot] || []) {
            const el = area.querySelector(sel);
            if (el) return el.closest("[class*='weaponWrapper']") || el;
        }
        return null;
    }

    function applyHighlights() {
        for (const h of AttackPage.highlights) {
            for (const slot of h.slots) {
                const el = slotWrapper(slot);
                if (el && el.getAttribute("data-ah-hl") !== h.strength && el.getAttribute("data-ah-hl") !== "strong") {
                    el.setAttribute("data-ah-hl", h.strength);
                }
            }
        }
    }

    const AttackPage = {
        active: false,
        highlights: [],
        observer: null,
        runId: 0,
        isAttackUrl() {
            const p = location.pathname;
            return (p === "/loader.php" || p === "/page.php") && /[?&]sid=attack(&|$)/.test(location.search);
        },
        startObserver() {
            if (this.observer) return;
            let pending = false;
            this.observer = new MutationObserver(() => {
                if (pending || !this.active) return;
                pending = true;
                requestAnimationFrame(() => {
                    pending = false;
                    if (!this.active) return;
                    Banner.place();
                    applyHighlights();
                });
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
        },
        stop() {
            this.active = false;
            this.highlights = [];
            clearHighlights();
            Banner.remove();
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
        },
        async run(fresh) {
            const runId = ++this.runId;
            this.active = true;
            this.startObserver();
            const targetId = Number(new URLSearchParams(location.search).get("user2ID")) || null;
            const s = Settings.get();
            if (!Api.key()) {
                Banner.render([{ level: "warn", html: esc(errText({ code: "no_key" })) }]);
                return;
            }
            Banner.render([{ level: "info", html: "Loading…" }]);
            try {
                const domReady = waitFor(attackerArea, 8000);
                const ctx = await loadCore(fresh ? 0 : 30_000);
                const settled = await Promise.allSettled([
                    Api.get("/user/equipment", fresh ? 0 : 15_000),
                    s.ammo ? Api.get("/user/ammo", fresh ? 0 : 5 * MIN) : null,
                    s.abroad ? Api.get("/user/profile", fresh ? 0 : MIN) : null,
                    s.bounty && targetId ? Api.get(`/user/${targetId}/bounties`, fresh ? 0 : 5 * MIN) : null,
                ]);
                if (runId !== this.runId) return;
                const val = (r) => (r.status === "fulfilled" ? r.value : null);
                await domReady;
                if (runId !== this.runId) return;
                const data = {
                    hasKick: kickAvailable(),
                    equipment: val(settled[0])?.equipment || null,
                    ammo: val(settled[1])?.ammo || [],
                    profile: val(settled[2])?.profile || null,
                    bounties: val(settled[3])?.bounties || [],
                };
                const { lines, highlights } = buildLines(ctx, data, s);
                if (!data.equipment && settled[0].status === "rejected") {
                    lines.unshift({ level: "warn", html: esc(errText(settled[0].reason)) });
                }
                clearHighlights();
                this.highlights = highlights;
                Banner.render(lines.length ? lines : [{ level: "ok", html: "No open award reminders for this fight." }]);
                applyHighlights();
            } catch (e) {
                if (runId !== this.runId) return;
                Banner.render([{ level: "warn", html: esc(errText(e)) }]);
            }
        },
    };

    const RefillBar = {
        el: null,
        lastCheck: 0,
        hide() {
            if (this.el) this.el.remove();
            this.el = null;
        },
        async run() {
            const s = Settings.get();
            if (!s.refill || !Api.key() || AttackPage.isAttackUrl()) {
                this.hide();
                return;
            }
            const day = utcDay();
            if (lsGet(LS.dismissPrefix + "refill") === day) {
                this.hide();
                return;
            }
            if (Date.now() - this.lastCheck < 30_000) return;
            this.lastCheck = Date.now();
            try {
                const [ctx, r] = await Promise.all([loadCore(10 * MIN), Api.get("/user/refills", 10 * MIN)]);
                const refills = r.refills || {};
                const msgs = [];
                const energy = num(dig(ctx.ps, "other.refills.energy"));
                const nerve = num(dig(ctx.ps, "other.refills.nerve"));
                if (refills.energy === false && !ctx.done(AW.energize, energy)) msgs.push(`⚡ Energy refill not used today · Energize ${fmtN(energy)}/250`);
                if (refills.nerve === false && !ctx.done(AW.nerve, nerve)) msgs.push(`🧠 Nerve refill not used today · Nerve ${fmtN(nerve)}/250`);
                if (!msgs.length) {
                    this.hide();
                    return;
                }
                this.show(msgs);
            } catch {
                this.hide();
            }
        },
        show(msgs) {
            this.hide();
            const el = document.createElement("div");
            el.id = "ah-refill";
            el.innerHTML = `<span>${msgs.map(esc).join(" &nbsp;|&nbsp; ")}</span><a href="https://www.torn.com/page.php?sid=points">Refill</a><button type="button" title="Hide until tomorrow (TCT)">✕</button>`;
            el.querySelector("button").addEventListener("click", () => {
                lsSet(LS.dismissPrefix + "refill", utcDay());
                this.hide();
            });
            document.body.appendChild(el);
            this.el = el;
        },
    };

    const Panel = {
        overlay: null,
        close() {
            if (this.overlay) this.overlay.remove();
            this.overlay = null;
        },
        open() {
            this.close();
            const overlay = document.createElement("div");
            overlay.id = "ah-overlay";
            overlay.innerHTML = `<div id="ah-panel"></div>`;
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) this.close();
            });
            document.body.appendChild(overlay);
            this.overlay = overlay;
            this.render();
            this.loadProgress(false);
        },
        render() {
            const s = Settings.get();
            const panel = this.overlay.querySelector("#ah-panel");
            const keyBlock = HAS_PDA_KEY
                ? `<div class="ah-hint">Using the Torn PDA API key.</div>`
                : `<div><input type="text" data-ah="key" placeholder="Torn API key (16 chars)" value="${esc(Api.key())}" maxlength="16"><button type="button" data-ah="save">Save</button><button type="button" data-ah="clear">Clear</button></div>
                   <div class="ah-hint">A Minimal access key is enough. A Limited key also shows your current kill streak. The key stays in this browser only.</div>`;
            panel.innerHTML = `
<div class="ah-top">
<h2>🏅 Award Helper <span style="color:#888;font-size:11px;font-weight:400;margin-left:6px">v${VERSION}</span>
<span style="color:#888;font-size:11px;font-weight:400;margin-left:10px">
    Like the script? Send a Xanax to
    <a href="https://www.torn.com/profiles.php?XID=4192025" target="_blank"
       style="color:#cc3333;text-decoration:none">eugene_s [4192025]</a>
</span></h2>
<button type="button" data-ah="close">✕</button>
</div>
<h3>API key</h3>
${keyBlock}
<h3>Reminders</h3>
${Object.keys(DEFAULT_SETTINGS).map((k) => `<label><input type="checkbox" data-ah-set="${k}" ${s[k] ? "checked" : ""}> ${esc(SETTING_LABELS[k])}</label>`).join("")}
<h3 class="ah-top">Progress <button type="button" data-ah="refresh">↻ Refresh</button></h3>
<div data-ah="progress" class="ah-hint">Loading…</div>
<div class="ah-hint" style="margin-top:10px">Version ${VERSION} · Platform: ${IS_PDA ? "Torn PDA" : "Desktop"}</div>`;
            panel.querySelector("[data-ah=close]").addEventListener("click", () => this.close());
            panel.querySelector("[data-ah=refresh]").addEventListener("click", () => this.loadProgress(true));
            const save = panel.querySelector("[data-ah=save]");
            if (save) {
                save.addEventListener("click", () => {
                    const v = panel.querySelector("[data-ah=key]").value.trim();
                    if (!/^[A-Za-z0-9]{16}$/.test(v)) {
                        panel.querySelector("[data-ah=progress]").textContent = "The key must have 16 letters or digits.";
                        return;
                    }
                    lsSet(LS.apiKey, v);
                    Api.clearCache();
                    this.loadProgress(true);
                    if (AttackPage.isAttackUrl()) AttackPage.run(true);
                });
                panel.querySelector("[data-ah=clear]").addEventListener("click", () => {
                    lsDel(LS.apiKey);
                    Api.clearCache();
                    this.render();
                    this.loadProgress(false);
                });
            }
            panel.querySelectorAll("[data-ah-set]").forEach((cb) => {
                cb.addEventListener("change", () => {
                    const next = Settings.get();
                    next[cb.dataset.ahSet] = cb.checked;
                    Settings.set(next);
                    if (AttackPage.isAttackUrl()) AttackPage.run(false);
                    else {
                        RefillBar.lastCheck = 0;
                        RefillBar.run();
                    }
                });
            });
        },
        async loadProgress(fresh) {
            if (!this.overlay) return;
            const box = this.overlay.querySelector("[data-ah=progress]");
            if (!Api.key()) {
                box.textContent = errText({ code: "no_key" });
                return;
            }
            box.textContent = "Loading…";
            if (fresh) Api.clearCache();
            try {
                const ctx = await loadCore(fresh ? 0 : 5 * MIN);
                if (!this.overlay) return;
                box.className = "";
                box.innerHTML = progressHtml(ctx);
            } catch (e) {
                box.className = "ah-hint";
                box.textContent = errText(e);
            }
        },
    };

    function row(name, count, target, done, note) {
        const pct = target ? Math.min(100, Math.round((num(count) / target) * 100)) : (done ? 100 : 0);
        const right = done
            ? `<span class="ah-done">✓ done</span>`
            : (target ? `${fmtN(count)}/${fmtN(target)}` : esc(note || "open"));
        return `<div class="ah-row"><div>${esc(name)}${note && !done && target ? ` <span class="ah-hint">${esc(note)}</span>` : ""}</div><div class="ah-bar"><i style="width:${done ? 100 : pct}%"></i></div><div class="ah-n">${right}</div></div>`;
    }

    function moneyRow(name, value, target, done) {
        const pct = Math.min(100, Math.round((num(value) / target) * 100));
        const right = done ? `<span class="ah-done">✓ done</span>` : `${money(value)}`;
        return `<div class="ah-row"><div>${esc(name)} <span class="ah-hint">of ${money(target)}</span></div><div class="ah-bar"><i style="width:${done ? 100 : pct}%"></i></div><div class="ah-n">${right}</div></div>`;
    }

    function tierRow(ctx, tiers, count, label) {
        const t = nextTier(ctx, tiers, count);
        if (!t) return row(`${label} (${tiers[tiers.length - 1].name})`, count, 0, true);
        return row(`${t.name} — ${label}`, count, t.target, false);
    }

    function progressHtml(ctx) {
        const ps = ctx.ps;
        const out = [];
        out.push("<h3>Finishing hits</h3>");
        const finish = FINISH.map((c) => ({ c, g: finishGoal(ctx, c) }))
            .sort((a, b) => {
                const ra = a.g ? a.g.tier * 1e7 + (a.g.target - a.g.count) : Infinity;
                const rb = b.g ? b.g.tier * 1e7 + (b.g.target - b.g.count) : Infinity;
                return ra - rb;
            });
        out.push(row("Leonidas — finish once with Kick", 0, 0, ctx.has(AW.leonidas), "open"));
        for (const { c, g } of finish) {
            if (!g) out.push(row(`${AW.warMachine.name} — ${c.label}`, 0, 0, true));
            else out.push(row(`${g.name} — ${c.label}`, g.count, g.target, false));
        }
        out.push("<h3>Fights</h3>");
        const bare = num(dig(ps, "attacking.unarmored_wins"));
        out.push(row("Bare — wins without armor", bare, 250, ctx.done(AW.bare, bare)));
        const intl = num(dig(ps, "travel.attacks_won"));
        out.push(row("International — wins abroad", intl, 100, ctx.done(AW.international, intl)));
        const assist = num(dig(ps, "attacking.attacks.assist"));
        out.push(row("Sidekick — assists", assist, 250, ctx.done(AW.sidekick, assist)));
        const streak = num(dig(ps, "attacking.killstreak.best"));
        const current = dig(ps, "attacking.killstreak.current");
        out.push(row(`Blitzkrieg — best kill streak${current != null ? ` (now ${fmtN(current)})` : ""}`, streak, 250, ctx.done(AW.blitz, streak)));
        out.push("<h3>Ammo</h3>");
        const special = num(dig(ps, "attacking.ammunition.special"));
        out.push(tierRow(ctx, SPECIAL_TIERS, special, "special rounds"));
        for (const [type, info] of Object.entries(AMMO_TYPES)) {
            const used = num(dig(ps, `attacking.ammunition.${info.key}`));
            out.push(row(`${info.name} — ${type} rounds`, used, info.target, ctx.done(info, used)));
        }
        out.push(row("Dragon's Breath — shoot a 12 Gauge Incendiary", 0, 0, ctx.has(AW.dragon), "open"));
        out.push("<h3>Bounties</h3>");
        const bCount = num(dig(ps, "bounties.collected.amount"));
        out.push(tierRow(ctx, BOUNTY_TIERS, bCount, "bounties"));
        const bValue = num(dig(ps, "bounties.collected.value"));
        out.push(moneyRow("Dead Or Alive — bounty money", bValue, AW.deadOrAlive.target, ctx.done(AW.deadOrAlive, bValue)));
        out.push("<h3>Refills</h3>");
        const e = num(dig(ps, "other.refills.energy"));
        out.push(row("Energize — energy refills", e, 250, ctx.done(AW.energize, e)));
        const n = num(dig(ps, "other.refills.nerve"));
        out.push(row("You've Got Some Nerve — nerve refills", n, 250, ctx.done(AW.nerve, n)));
        return out.join("");
    }

    (function setupEugFooterMenu() {
        const W = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;
        if (W.__eugFooterMenuLoaded) return;
        W.__eugFooterMenuLoaded = true;
        W.__eugeneScripts = W.__eugeneScripts || [];

        const ROW_ID = "eug-footer-row";

        function injectCSS() {
            if (document.getElementById("eug-footer-style")) return;
            const style = document.createElement("style");
            style.id = "eug-footer-style";
            style.textContent = `
[data-eug="menu"]{background:linear-gradient(to bottom,#444,#2a2a2a)!important}
[data-eug="menu"]:hover{background:linear-gradient(to bottom,#555,#333)!important}
#${ROW_ID}{display:none;position:fixed;padding:4px;
  background:rgba(20,20,20,0.96);border:1px solid #444;border-radius:6px;
  gap:4px;z-index:2147483647;white-space:nowrap;pointer-events:auto}
#${ROW_ID}.eug-open{display:flex;flex-direction:row}
`;
            document.head.appendChild(style);
        }

        function injectEntryCSS(entry) {
            if (!entry.color) return;
            const id = `eug-color-${entry.id}`;
            const existing = document.getElementById(id);
            const dark = entry.colorDark || "#222";
            const hover = entry.hoverColor || entry.color;
            const css = `
[data-eug-id="${entry.id}"]{background:linear-gradient(to bottom, ${entry.color}, ${dark})!important}
[data-eug-id="${entry.id}"]:hover{background:linear-gradient(to bottom, ${hover}, ${entry.color})!important}
`;
            if (existing) { existing.textContent = css; return; }
            const el = document.createElement("style");
            el.id = id;
            el.textContent = css;
            document.head.appendChild(el);
        }

        function findRefBtn() {
            return document.getElementById("notes_panel_button")
                || document.getElementById("people_panel_button");
        }

        function getRow() { return document.getElementById(ROW_ID); }
        function closeRow() { const r = getRow(); if (r) r.classList.remove("eug-open"); }

        function openRow(menuBtn) {
            const row = getRow();
            if (!row) return;
            const rect = menuBtn.getBoundingClientRect();
            row.classList.add("eug-open");
            const rowRect = row.getBoundingClientRect();
            const gap = 6;
            const centerX = rect.left + rect.width / 2;
            let left = centerX - rowRect.width / 2;
            const maxLeft = window.innerWidth - rowRect.width - 4;
            left = Math.max(4, Math.min(left, maxLeft));
            row.style.left = left + "px";
            row.style.bottom = (window.innerHeight - rect.top + gap) + "px";
        }

        function makeScriptBtn(entry, refBtn, role) {
            const iconClasses = refBtn.querySelector("svg")?.className?.baseVal || "";
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = refBtn.className;
            btn.title = entry.name;
            btn.setAttribute("data-eug", role);
            btn.setAttribute("data-eug-id", entry.id);
            const svg = (entry.iconSVG || "").replace(/<svg\b([^>]*)>/, (match, attrs) =>
                /\sclass\s*=/.test(attrs) ? match : `<svg${attrs} class="${iconClasses}">`);
            btn.innerHTML = svg;
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeRow();
                try { entry.onClick(); } catch { /* noop */ }
            });
            injectEntryCSS(entry);
            return btn;
        }

        function makeMenuBtn(refBtn) {
            const iconClasses = refBtn.querySelector("svg")?.className?.baseVal || "";
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = refBtn.className;
            btn.title = "My userscripts";
            btn.setAttribute("data-eug", "menu");
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" class="${iconClasses}">
                <defs><linearGradient id="eug_menu_grad" x1="0.5" x2="0.5" y2="1" gradientUnits="objectBoundingBox">
                    <stop offset="0" stop-color="#ddd"/><stop offset="1" stop-color="#999"/>
                </linearGradient></defs>
                <g fill="url(#eug_menu_grad)">
                    <circle cx="5" cy="12" r="2"/>
                    <circle cx="12" cy="12" r="2"/>
                    <circle cx="19" cy="12" r="2"/>
                </g>
            </svg>`;
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const row = getRow();
                if (row && row.classList.contains("eug-open")) closeRow();
                else openRow(btn);
            });
            return btn;
        }

        const LEGACY_BUTTON_IDS = ["tat-footer-btn", "spa-footer-btn"];

        function render() {
            const refBtn = findRefBtn();
            if (!refBtn) return false;
            injectCSS();

            const parent = refBtn.parentNode;
            parent.querySelectorAll('[data-eug]').forEach((el) => el.remove());
            LEGACY_BUTTON_IDS.forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.remove();
            });
            const oldRow = getRow();
            if (oldRow) oldRow.remove();

            const scripts = W.__eugeneScripts || [];
            if (scripts.length === 0) return true;

            if (scripts.length === 1) {
                parent.insertBefore(makeScriptBtn(scripts[0], refBtn, "solo"), refBtn);
            } else {
                const menuBtn = makeMenuBtn(refBtn);
                parent.insertBefore(menuBtn, refBtn);
                const row = document.createElement("div");
                row.id = ROW_ID;
                row.setAttribute("data-eug-row", "");
                for (const s of scripts) row.appendChild(makeScriptBtn(s, refBtn, "item"));
                document.body.appendChild(row);
            }
            return true;
        }

        function mount() {
            render();
            let pending = false;
            const obs = new MutationObserver(() => {
                if (pending) return;
                pending = true;
                requestAnimationFrame(() => {
                    pending = false;
                    const refBtn = findRefBtn();
                    if (refBtn && !refBtn.parentNode.querySelector('[data-eug]')) render();
                });
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }

        W.addEventListener("eugene-scripts-updated", render);
        document.addEventListener("click", (e) => {
            const row = getRow();
            if (!row || !row.classList.contains("eug-open")) return;
            const menuBtn = document.querySelector('[data-eug="menu"]');
            if (menuBtn && menuBtn.contains(e.target)) return;
            if (row.contains(e.target)) return;
            closeRow();
        });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeRow(); });
        W.addEventListener("scroll", closeRow, { passive: true });
        W.addEventListener("resize", closeRow);

        W.registerEugeneScript = function (entry) {
            const list = W.__eugeneScripts;
            const i = list.findIndex((s) => s.id === entry.id);
            if (i >= 0) list[i] = entry;
            else list.push(entry);
            W.dispatchEvent(new CustomEvent("eugene-scripts-updated"));
        };
        W.mountEugeneFooterMenu = mount;
    })();

    const AH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <defs><linearGradient id="ah_icon_grad" x1="0.5" x2="0.5" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0" stop-color="#ddd"/><stop offset="1" stop-color="#999"/>
        </linearGradient></defs>
        <g fill="url(#ah_icon_grad)">
            <path d="M7 1h4l1.5 6h-3zM13 1h4l-2.5 6h-3z"/>
            <path d="M12 8a7.5 7.5 0 1 0 7.5 7.5A7.5 7.5 0 0 0 12 8Zm0 13a5.5 5.5 0 1 1 5.5-5.5A5.5 5.5 0 0 1 12 21Z"/>
            <path d="M12 11.6l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z"/>
        </g>
    </svg>`;

    function main() {
        injectCSS();
        PAGE.registerEugeneScript({
            id: "ah",
            name: "Award Helper",
            color: "#b8921f",
            colorDark: "#5e4a0f",
            hoverColor: "#d6ab2a",
            iconSVG: AH_ICON_SVG,
            onClick: () => Panel.open(),
        });
        PAGE.mountEugeneFooterMenu();

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && Panel.overlay) Panel.close();
        });

        let lastHref = "";
        const tick = () => {
            if (location.href === lastHref) return;
            lastHref = location.href;
            if (AttackPage.isAttackUrl()) {
                RefillBar.hide();
                AttackPage.run(false);
            } else {
                if (AttackPage.active) AttackPage.stop();
                RefillBar.run();
            }
        };
        tick();
        setInterval(tick, 1000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", main);
    } else {
        main();
    }
})();
