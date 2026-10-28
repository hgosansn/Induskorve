# Industrial nocturne — visual direction

## Reference study

- [Syd Mead — official gallery](https://www.sydmead.com/gallery) and [Blade Runner gouaches at the Whitney](https://whitney.org/exhibitions/dreamlands/art?section=48): the study uses monumental mass, overhangs, service layers and small concentrated lights to establish scale. These are design interpretations, not copied assets.
- [Paul Chadeisson — portfolio](https://paulchadeisson.com/projects), [Solstice-5 coverage and imagery](https://80.lv/articles/learn-story-of-solstice-5-in-this-highly-realistic-sci-fi-short-movie): broad industrial surfaces punctuated by dense working edges; avoid evenly scattering detail over every face.
- [Archigram, Plug-in City — Centre Pompidou collection](https://www.centrepompidou.fr/fr/ressources/oeuvre/cMaqqM): a reference for visible structural frames and replaceable functional units.

The curated OpenAI skill catalog was checked. Its visual workflows center on Figma, which this project does not require. [Anthropic's frontend-design guidance](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) was read and used for subject-led planning, hierarchy and screenshot critique; no external skill or plugin was installed and no reference images are shipped.

## Design plan

The city is the main visual. A restrained square interface surrounds it; no hero copy, new dashboard or bottom panels. Keep charcoal/concrete with yellow electricity, blue logistics and copper production. All values remain in `src/app/palette.css`. UI typography stays compact and quiet; architectural lettering sits on facades and serves identity. Working light must have a source.

| Piece        | Shape and material                                                | Meaning                                        |
| ------------ | ----------------------------------------------------------------- | ---------------------------------------------- |
| Ground       | Dark engineered slab, exposed perimeter, inset service strips     | Local reveal and operating footprint           |
| Power        | Faceted cooling towers, turbine gallery, insulator rack           | Generation and additional turbine capacity     |
| Foundry      | Serrated roof, furnace throat, buttresses, exhaust                | Metal output; scrubber changes exhaust         |
| Warehouse    | Low freight terraces, recessed shutters, container stacks         | Stored inventory and logistics capacity        |
| Modules      | Radiator bank, turbine, furnace, scrubber, crane bay, solar array | Existing domain configuration                  |
| Service core | Low, stepped or vertical control volume                           | Chosen shape and human scale                   |
| Connections  | Sagging wires, overhead logistics dots, low copper pipes          | Existing power, material and heat dependencies |
| Light        | Small lamps, hot openings, restrained reflected light             | Powered/working state                          |

Every asset reads in three levels: silhouette first, structure second, small fittings only at closer zoom. Maintain repeated construction rhythms and large quiet faces; do not add random antennas or decorative machinery. Avoid borrowing the references' scale literally: one tile remains one actual building footprint.

## Review surface

The Atlas uses the same building drawing code as the city and workshop. It exposes foundation, shell, machinery, fitted modules and services in assembled and exploded views, plus operating/idle states. Its configuration is temporary and never edits or saves the city. Spectators may use it.

Acceptance: all three roles distinguishable without network lines; modules visibly disappear when disabled; no phantom inventory; lights/smoke respond to activity; palette still centralized; ghost stays faithful; old saves remain valid. This is a visual iteration, not a change to the industrial balancing or multiplayer status.
