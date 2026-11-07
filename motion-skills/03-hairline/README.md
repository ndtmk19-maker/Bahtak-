# hairline

**Source URL:** [https://hairline.lucasmarkes.com/skills](https://hairline.lucasmarkes.com/skills)
**Title:** Make your own figure · hairline

## Content & Instructions:

hairline
v0.5.1
Figures
Skills
Docs
Inspo

hairline-create

Install
How to use it
How it works
What it draws

hairline-adopt

Start from an SVG
How it reads a drawing
What it made

SKILLS

Make your own figure

Two skills for coding agents. hairline-create draws a new figure from an idea, and hairline-adopt starts from an SVG you already have. Both draw to Hairline's ten rules, on the same engine as the thirty-three in the docs, as one HTML file.

Install
$
npx skills add lucasmarkes/hairline

One command installs both skills. Each is a folder of small text files. There is no npm install, and Node is only needed to run the checks.

How to use it
/hairline-create <idea>
Type the command with an idea. If you already have the metaphor, say it, and the concepts step is skipped.
Out comes hairline-<name>.html: one file with no dependencies that opens from disk, holding the figure, an intensity slider, a theme switch and a play button that walks its tour.
It runs on any agent that reads skills: Claude Code, Cursor, Codex and others.
How it works
Concepts. It offers two or three concepts, one line each: the object, what the pointer does, what the read-out says. You pick one.
Build. It writes only the figure. The engine and the page around it are pasted in as they are.
Check. A script checks the file against the rules, then the agent looks at it in a browser.
Hand over. You get the page, the metaphor it used, the rules it leans on, and anything it could not check.
Adjust. Ask for changes while you use it. It edits the figure and checks again.
What it draws

Four ideas, four files. Each one opens from disk with no dependencies. Move the pointer over one.

/hairline-create a sales funnel

funnel

Four trays step down, each narrower with fewer beads: the stage under the pointer lifts, its neighbours rising less in turn.

/hairline-create a rate limiter

clearance

Each second is a column of requests: a burst lifts the ones near the pointer, and none of them gets past the bar.

/hairline-create git branches

sidings

A trunk line and three sidings: the track under the pointer is checked out, its wagons rising in turn to a bright head.

THEN ASKED

The rails almost disappear and the trains read as loose blocks. Make it read as a railway at a glance.
/hairline-create weather over a city

storm

A cloud you steer over a district rains on the roofs under it; only the rain from its middle reaches them.

THEN ASKED

The cloud looks like a stack of cylinders. Make it read as a cloud at a glance.
Start from an SVG
/hairline-adopt <file.svg>
Give it one SVG: an icon, a logo or an illustration. Say what the pointer should do, or leave that to the concepts.
Out comes hairline-<name>.html, the same kind of file hairline-create writes. It hands the drawing to hairline-create, so the build and the checks are that skill's.
How it reads a drawing
Read. It measures the SVG's shapes and says what it read the drawing as and which parts it kept. If the reading is wrong, say so and it reads again.
Concepts. It offers two or three gestures for that object, one line each. You pick one.
Build. It builds the object new, as solids on Hairline's engine. It never traces the SVG and never animates it.
Check. The same checks as hairline-create, with your SVG beside the figure, so the agent can see it still reads as yours.
Hand over. You get the page. If the mark belongs to someone else, it tells you so.
What it made

Five SVGs, five files. The rocket was drawn for the demo; the other four are companies’ marks. Each page took a few rounds of changes after the first line. Move the pointer over one.

/hairline-adopt deploy.svg the pointer's height is the thrust; raised high enough, the rocket lifts off

deploy-liftoff

A rocket on its pad: the pointer's height is the thrust, and raised high enough it lifts off on a flame and settles back.

/hairline-adopt firecrawl.svg the flame reads a page: point down it, and each part peels off onto a sheet of markdown

firecrawl-reader

The flame reads a page: point down the page, and every part it passes peels off and settles, in order, on a sheet of markdown.

/hairline-adopt resend.svg the R is the sender: while the pointer is over it, a belt runs out of its block and each letter rides it into a tray

resend-belt

The R on its block: while the pointer is over it, the belt runs and the letters come out from under it into the tray.

/hairline-adopt linear.svg the stripes are lanes: point up across them, and the issues move lane to lane until they are done

linear-cycle

The mark's stripes are lanes: point up across them, the way it moves, and the issues glide lane to lane until they stack, done, on the disc.

/hairline-adopt cursor.svg the mark is the caret over code: point down the page, and each suggested line is accepted

cursor-tab

The mark is the caret over code: point down the page, and each suggested line down to the pointer is accepted, in order.

Brands I like, drawn as a tribute. The marks belong to their owners; Hairline is not affiliated with them.

The thirty-three figures and their options are in the docs. The skills’ files are on GitHub, in hairline-create and hairline-adopt.

MIT licensed. Built by Lucas Marques.

X
GitHub
npm
llms.txt

## Code & Prompts:

### Block 1
```
The rails almost disappear and the trains read as loose blocks. Make it read as a railway at a glance.
```

### Block 2
```
The cloud looks like a stack of cylinders. Make it read as a cloud at a glance.
```

### Block 3
```
/hairline-adopt deploy.svg the pointer's height is the thrust; raised high enough, the rocket lifts off
```

### Block 4
```
/hairline-adopt firecrawl.svg the flame reads a page: point down it, and each part peels off onto a sheet of markdown
```

### Block 5
```
/hairline-adopt resend.svg the R is the sender: while the pointer is over it, a belt runs out of its block and each letter rides it into a tray
```

### Block 6
```
/hairline-adopt linear.svg the stripes are lanes: point up across them, and the issues move lane to lane until they are done
```

### Block 7
```
/hairline-adopt cursor.svg the mark is the caret over code: point down the page, and each suggested line is accepted
```