# anatomy-reveal

**Source URL:** [https://typingmind.com/skills/annnguyentt-anatomy-reveal](https://typingmind.com/skills/annnguyentt-anatomy-reveal)
**Title:** Anatomy Reveal by annnguyentt — AI Skill for Any LLM | TypingMind

## Content & Instructions:

TypingMind
The best frontend for AI
Solutions
Resources
Pricing
FAQs
Go to app
Home
AI Skills
Research AI Skills
Anatomy Reveal
Anatomy Reveal
Community
annnguyentt
anatomy-reveal

Build any physical object (a product, a tool, furniture, an instrument, a shoe, a vehicle, a piece of jewellery, kitchenware, a toy, even a fruit or a flower) as a crafted isometric "anatomy" figure made of many small convex parts, then turn it into (1) an interactive dissection page you can drag, turn and take apart, and (2) a product-reveal film (MP4, 9:16, 4:5, 1:1 or 16:9, 30 fps, motion blur, white paper look, 10 s by default, any length from 3 to 60 s). The film tumbles in, whips to macro shots of the object's details, shows one feature working, explodes into its parts and snaps back together for a hero shot. Works from a photo of the object or from just its name. Use it when someone asks for an exploded view, a teardown or dissection drawing, an anatomy figure, or a product reveal or product motion video of an object.

Overview
Publisher	annnguyentt
Repository	anatomy-reveal-skill
Skill name	anatomy-reveal
Stars	
0

Forks	
0

Bundled files	
34

License	MIT
Links	
Skill source
Repository
Markdown instructions

A SKILL.md file the model loads on demand, so it only costs tokens when a request actually matches.

Works with any LLM

AI skills are plain Markdown, not provider-specific code, so this works with GPT, Claude, Gemini, Grok, or a local model.

34 bundled files

Scripts, templates, and references the model can read while it works. Files are read-only and never executed.

Open source

Published by annnguyentt on GitHub. Read the source before you install it.

Installation

Install the Anatomy Reveal AI skill in TypingMind to use it with any LLM, or drop it into another agent that reads SKILL.md.

1
Install in TypingMind

TypingMind installs a skill straight from its GitHub folder — it reads SKILL.md, bundles the resource files, and stores the result locally.

Open the app and go to Plugins → Skills.
Choose "Install from GitHub".
Paste the skill folder URL below and confirm.
https://github.com/annnguyentt/anatomy-reveal-skill/tree/main
Copy
Enable the skill in any chat where you want it available.
STORE
INSTALLED
Skills
Add skills

Import one or more skills from a public GitHub folder or a local .skill or .zip archive, or SKILL.md file.

From GitHub URL
From .skill, .zip, or SKILL.md
GitHub repo or folder
https://github.com/annnguyentt/anatomy-reveal-skill/tree/main

Points to a single skill folder, or any folder that contains multiple skills. Public repos only.

Cancel
Continue
Plugins → Skills → Add skill → From GitHub URL, then paste the folder URL and press Continue.
2
Install in another agent

Any agent that reads the Agent Skills format can use this skill — copy the folder into that agent's skills directory.

Claude Code
Cursor
Codex
Claude Code — .claude/skills
Copy
git clone --depth 1 https://github.com/annnguyentt/anatomy-reveal-skill.git \
  .claude/skills/anatomy-reveal
Restart Claude Code after copying so it picks up the new skill.
Use it in TypingMind

Enable Anatomy Reveal in any TypingMind chat and the model takes it from there. Its name and description sit in the system prompt, and the moment a request matches, the model loads the full instructions itself — you never invoke it by hand, and it costs no tokens until it is actually used.

Skills
Load skill
"anatomy-reveal"
GPT-6 Astra
The model loads Anatomy Reveal on its own as soon as a request matches it.
Works with any AI model

AI skills are plain Markdown instructions rather than provider-specific code, so Anatomy Reveal is not tied to the model it was written for. Install it once in TypingMind and use it with GPT-5, Claude, Gemini, Grok, DeepSeek, Mistral, Llama, or a local model you run yourself — all on your own API keys.

Loaded only when it is needed

The system prompt carries just the name and description. The instructions are fetched on the first matching request, so an idle skill costs nothing.

Switch models mid-chat

Because the skill is instructions rather than code, changing model does not break it — the next model reads the same SKILL.md.

Skill instructions

This is the SKILL.md content the model loads. Read it before installing — a skill is instructions your model will follow.

Anatomy Reveal

The object is never a stock 3D model or a traced picture. It is built part by part from its real dimensions, with the Anatomy kit's 3D mode (template/kit):

every panel, screw, dial, glass element and board is its own convex solid;
each part is shaded in four tones by how it faces the light;
parts are painted in an order solved from separating planes.

Because the object is real geometry, the same model turns through any angle, comes apart, and drives both outputs.

template/ is a complete working project. Its worked example is a dual-boiler espresso machine with a built-in grinder (82 parts), but nothing in the pipeline is specific to espresso machines: any object the user names or shows works the same way. Start every job from the template and replace the object.

Read before building:

references/inputs.md: getting from a photo or a name to dimensions, features and a parts list.
references/objects.md: how any kind of object comes apart, and how to build curved, organic, soft and large shapes from convex parts.
references/object.md: how to build the object so it turns through every angle and comes apart cleanly.
references/shots.md: the film's beats, the timeline format, eases and framing.
references/look.md: the paper look, materials and line weights.
Inputs: two cases

A. The user uploads an image of the object.

Study it for silhouette, proportions, materials, colours, surface decoration, visible controls, ports and markings, and anything that moves.
If you can tell what product it is, also look up its real dimensions and internals as in case B. Otherwise estimate the size from a feature of known size and say what you assumed.
The image is a reference only. Rebuild every shape, colour and ornament as geometry: never trace it, embed it, or map its pixels onto anything.

B. The user only names the object.

Research the real product:
overall dimensions in millimetres, and the main sub-dimensions;
materials and colourways;
every visible control, port and marking;
how it opens, folds, slides or turns;
what is inside (teardowns are the best source).
Use web search when you have it. Without it, use what you know and list your assumptions.
If the name is ambiguous (a model family, several generations), pick the most common variant and say which.

Either way, finish with a short spec before any geometry: the dimensions, the feature list, the parts list grouped by assembly, and the one or two features that will move in the film. Show it to the user if anything is uncertain.

Workflow

Size it. An object is a "Hero": 100–150 parts, about 2–4 hours for the object and about 1 hour for the film. Tell the user, then build. Have the object rendering on a test page early, and deepen it from there.

Gather the facts for case A or B above (references/inputs.md).

Scaffold: node <skill>/scripts/new-project.mjs <dir>. It copies template/, installs puppeteer-core and builds the example, which proves the toolchain works on this machine.

Build the object in object/geometry.mjs, following the rules in references/object.md:

a hollow shell of convex panels;
explode assemblies whose outer parts lead;
feature groups (hinges, turns, slides);
anchors for every shot;
markings as face planes.

Iterate with these, and look at every image you make:

node object/test-page.mjs --light;
node object/shots.mjs object/test-light.html out/t/a '{"yaw":-35,"pitch":12}' '{"yaw":-35,"pitch":20,"apart":1}';
node object/scan-apart.mjs <yaw> <pitch> from five views (front, back, top, below, side), until each says no pairs pass through each other and no forced picks.

Describe the object in object/film.mjs. The figure page and the film read everything object-specific from this one file:

FILM: the title, the scene radius (about 0.8 × the largest dimension in mm), an accessible label, the bounding box;
FIGURE: the page title, starting view, legend keys and caption (with {parts}, {assemblies} filled in);
FEATURE_DEFAULTS and FEATURE_KEYS: each moving feature, its key on the page, its values or step;
featureValues and featureTravel: how features map to groups and how far they move a part.

The anatomy page. Run node object/build.mjs and --light to write object/figure.html and object/figure-light.html. Serve the folder over http to look at it in a browser.

Choose the length and the ratio. Ask the user if they have not said (default 10 s, 9:16), then build the film page with node motion/build.mjs --duration <seconds> --ratio <9:16|4:5|1:1|16:9> (3–60 s). Whips keep their length; drifts and holds stretch or compress. For films over about 12 s, add beats (more detail shots) rather than only stretching.

Choreograph motion/timeline.mjs beat by beat (references/shots.md):

frame every shot with node motion/render.mjs poses '[…]' out/p and pick by eye;
check timing with node motion/render.mjs stills 0,1.2,2.3,3.5,4.6,5.6,7.9,10 out/s;
node motion/scan.mjs must report every frame clean.

Render: node motion/render.mjs blur out/blur --step 4 --most 40, then node motion/encode.mjs out/blur out/<name>.mp4.

The render sizes each frame's motion blur from how far the picture moves: whips get up to 40 sub-frames, holds 1.
It takes about 2 minutes per second of film. Run it in the background and keep other browser work off the machine.

Check the MP4 itself. Extract frames (ffmpeg -i out/<name>.mp4 -vsync 0 out/check/f_%03d.png), contact-sheet a dozen of them, and look.

Deliver: the MP4, the two figure pages and the project folder. Say what you did not verify. The film is silent; offer to cut it to a track the user supplies.

Rules
Geometry only. No images from the user, the web or a generator end up in the figure or the film. Decoration such as engraving, filigree or print is drawn: SVG on a face plane, or raised convex pieces.
True to the object. Use real millimetres, the real count of buttons and screws, and the real way it opens. Detail comes from real parts, never noise.
Convex parts only, never sunk in. The build refuses a pair it cannot separate: move or split the part.
One continuous take. Change subject with a whip (about 0.24 s); holds keep drifting; the last half-second is the only stillness.
Paper look. The film is drawn on warm white paper in the kit's light theme: ink outlines, four-tone fills. Keep it unless the user asks otherwise.
Neutral markings by default. Label parts generically (SoC, crown, battery). Draw a maker's logo or trademark only when the user asks for a faithful replica.
Files
Path	What
scripts/new-project.mjs	Copies the template into a new folder, installs, builds the example.
template/kit/	The Anatomy kit (MIT), with extra materials (glass, pcb, sensor, signal, porcelain, lavender, knit, coffee, bean, milk, smoke) and two debug hooks in turn.mjs.
template/object/geometry.mjs	The object: parts, groups, explode assemblies, feature poses, anchors.
template/object/scene.mjs	Projection, build, orient() (yaw, pitch, roll in view space), explodeValues().
template/object/film.mjs	Everything object-specific the page and the film read: titles, scene radius, labels, bounds, feature channels and keys.
template/object/build.mjs, live.js	The interactive anatomy page.
template/object/test-page.mjs, shots.mjs, scan-apart.mjs, capture.mjs	The bare test page, posed screenshots, the explode pass-through sweep, page captures.
template/motion/timeline.mjs	Keys, eases, labels, the retiming behind --duration and the framing behind --ratio.
template/motion/build.mjs, look.css	The film page: frame(t), pose(state), speed(t).
template/motion/render.mjs, encode.mjs, scan.mjs	Stills, poses, the adaptive-blur render; averaging and H.264 encode; the per-frame order check.
template/scripts/browser.mjs	Finds Chrome, Chromium or Edge on macOS, Linux or Windows (CHROME_PATH overrides).
Expand
Bundled files

The model reads these on demand while the skill is loaded. They are exposed as readable files and are never executed.

demo/apart.png
383 KB
demo/espresso-machine.mp4
1.8K KB
demo/hero.png
317 KB
references/inputs.md
4 KB
references/look.md
2 KB
references/object.md
5 KB
references/objects.md
5 KB
references/shots.md
6 KB
scripts/new-project.mjs
1 KB
template/kit/audit.mjs
91 KB
template/kit/iso-kit.mjs
34 KB
template/kit/lathe.mjs
47 KB
template/kit/tube.mjs
14 KB
template/kit/turn-build.mjs
64 KB
template/kit/turn.mjs
142 KB
template/motion/build.mjs
6 KB
template/motion/encode.mjs
2 KB
template/motion/look.css
3 KB
template/motion/render.mjs
3 KB
template/motion/scan.mjs
1 KB
template/motion/timeline.mjs
6 KB
template/object/build.mjs
3 KB
template/object/capture.mjs
1 KB
template/object/film.mjs
3 KB
template/object/geometry.mjs
26 KB
template/object/live.js
5 KB
template/object/scan-apart.mjs
1 KB
template/object/scene.mjs
2 KB
template/object/shots.mjs
2 KB
template/object/test-page.mjs
2 KB
template/package.json
1 KB
template/scripts/browser.mjs
1 KB
template/scripts/inline-kit.mjs
1 KB
THIRD_PARTY_NOTICES.md
1 KB
Frequently asked questions
What does the Anatomy Reveal AI skill do?
Why use Anatomy Reveal on TypingMind?
How do I install Anatomy Reveal in TypingMind?
Which AI models can use Anatomy Reveal?
How many AI models can I use with Anatomy Reveal?
Is the Anatomy Reveal AI skill free?
What are AI skills?
How are AI skills different from plugins or MCP servers?
TABLE OF CONTENTS
Overview
Installation
Use it in TypingMind
Skill instructions
Bundled files
FAQ
Use Agent Skills with any AI model
✓
Install any skill from GitHub in one paste
✓
Works with GPT, Claude, Gemini, and local models
✓
Bring your own API keys
...and much more
Try free
Trusted by 20,641+ customers
Related AI Skills
View all

Creative Ideation

NousResearch
Organization
Popular

Generate ideas via named methods from creative practice.

53.5K
250.4K
27 files
View

Inference Sh Cli

NousResearch
Organization
Popular

Run 150+ AI apps (image, video, LLM) via inference.sh CLI.

53.5K
250.4K
4 files
View

Firecrawl Build Search

firecrawl
Organization
Popular

Integrate Firecrawl `/search` into product code and agent workflows. Use when an app needs discovery before extraction, when the feature starts with a query instead of a URL, or when the system should…

9.8K
181.6K
Instructions
View

Firecrawl Build

firecrawl
Organization
Popular

Integrate Firecrawl into application code whenever a product, agent, or workflow needs web data inside the app — web search, live search results, page scraping, structured extraction, or browser…

9.8K
181.6K
6 files
View
Set up your own AI workspace now
Get a lifetime license

Get notified about new features and future giveaways by subscribing to our newsletter 👇

Notify Me
TypingMind

Your personal AI workspace

Twitter
LinkedIn
YouTube
Facebook

5 on Capterra

4.9 on Product Hunt

4.5 on Setapp

4.6 on TrustPilot

PRODUCTS

TypingMind for Teams
TypingMind for Individuals

ABOUT

Company
Careers
Contact
Pricing
FAQs
Reseller Program
Service Status

RESOURCES

Changelog
Documents
MCP Directory
Skills Directory

LEGAL & SECURITY

Privacy Policy
Terms of Service
GDPR
Data Processing Agreement
Trust Center
Vulnerability Disclosure Policy

USE CASES

Engineering
Marketing
Sales
Operations
Legal & Compliance
E-Commerce
Education
Finance & Insurance
Technology Development

CUSTOMER STORIES

InnoGames
Agentiiv
Traffic Builders
Atomic Object
Mention Me
PixelMechanics
Entrepreneurs Circle
Eugeniuses
Mill Pond Research
ITHQ
i22

FREE TOOLS

Model Icons
Generative AI Quiz
LLM API Cost Estimation

GUIDE

OpenAI API Key
Claude API Key
Perplexity API Key
OpenRouter API Key
DeepSeek API Key
Grok API Key
Gemini API Key
Mistral AI API Key
More guides...

Copyright © 2026, All Rights Reserved

All systems operational

## Code & Prompts:

### Block 1
```
https://github.com/annnguyentt/anatomy-reveal-skill/tree/main
```

### Block 2
```
git clone --depth 1 https://github.com/annnguyentt/anatomy-reveal-skill.git \
  .claude/skills/anatomy-reveal
```

### Block 3
```
git clone --depth 1 https://github.com/annnguyentt/anatomy-reveal-skill.git \
  .claude/skills/anatomy-reveal
```

### Block 4
```
node object/shots.mjs object/test-light.html out/t/a '{"yaw":-35,"pitch":12}' '{"yaw":-35,"pitch":20,"apart":1}'
```

### Block 5
```
node motion/build.mjs --duration <seconds> --ratio <9:16|4:5|1:1|16:9>
```

### Block 6
```
node motion/render.mjs stills 0,1.2,2.3,3.5,4.6,5.6,7.9,10 out/s
```

### Block 7
```
node motion/render.mjs blur out/blur --step 4 --most 40
```

### Block 8
```
ffmpeg -i out/<name>.mp4 -vsync 0 out/check/f_%03d.png
```