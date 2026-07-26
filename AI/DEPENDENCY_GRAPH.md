# VROO DEPENDENCY GRAPH

- **foundation** 쨌 READY 쨌 score 72% 쨌 depends: - 쨌 blocked by: -
- **brain** 쨌 READY 쨌 score 0% 쨌 depends: foundation 쨌 blocked by: -
- **orchestrator** 쨌 READY 쨌 score 0% 쨌 depends: brain 쨌 blocked by: -
- **architecture** 쨌 READY 쨌 score 57% 쨌 depends: foundation 쨌 blocked by: -
- **character** 쨌 BLOCKED 쨌 score 57% 쨌 depends: architecture 쨌 blocked by: architecture
- **garage** 쨌 BLOCKED 쨌 score 57% 쨌 depends: character, profile, core-ui 쨌 blocked by: character
- **profile** 쨌 BLOCKED 쨌 score 78% 쨌 depends: architecture, core-ui 쨌 blocked by: architecture
- **chat** 쨌 READY 쨌 score 90% 쨌 depends: storage, core-ui 쨌 blocked by: -
- **storage** 쨌 BLOCKED 쨌 score 0% 쨌 depends: architecture 쨌 blocked by: architecture
- **core-ui** 쨌 BLOCKED 쨌 score 0% 쨌 depends: architecture 쨌 blocked by: architecture
- **delivery** 쨌 BLOCKED 쨌 score 90% 쨌 depends: core-ui, chat, garage, profile 쨌 blocked by: garage
