# Context

This is my personal website Vite React TS project

# Dev Rules

1. never commit code or run dev server, these will be handled by me
2. run lint and build after code change to make sure code is clean

# Optimization Principles

- The website should be generally optimized for network loading and performance, unless certain elements are decided (by me) to be quality over performance, which might lead to poorer performance on less capable machines of visitors--agreed compromises
- Always lazy loading unless told otherwise--never load things unless it's needed
- Make sure static assets involved are always minimum to load (fewer is better, smaller is better) above a accepted quality threshold
- Never load other assets when currently needed priority assets haven't been loaded (or are being loaded)