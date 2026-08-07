---
name: create-implementation-plan
description: Create a user-facing, checkbox-tracked implementation plan.
disable-model-invocation: true
---

# Create Implementation Plan

Create a plan for the user to implement the requested work. This is a planning pass, not an
implementation pass.

## Process

1. Invoke `/implement` to load the implementation workflow. Gather the request's full context:
   inspect the referenced spec or ticket, its comments and dependencies, relevant code and tests,
   and applicable project guidance. Do not edit files, run implementation validation, review
   changes, or commit during this planning pass.

   Complete when the requested behavior, current implementation boundary, and test seams are known.

2. Resolve material ambiguities that would change the plan. Ask one concise question when the
   available specification cannot determine a necessary product or technical decision; otherwise,
   make the plan from the available evidence.

   Complete when each task has a definite outcome and ordering.

3. Present the plan in this user-facing format:

   ```md
   ## Overview

   <Detailed explanation of what you will implement, its user-visible behavior, boundaries, and
   relationship to existing code.>

   ## Implementation Tasks

   ### <Related task group>

   - [ ] <Ordered, concrete task with its completion criterion.>
   - [ ] <Ordered, concrete task with its completion criterion.>

   ### <Next related task group>

   - [ ] <Ordered, concrete task with its completion criterion.>
   ```

   Write the overview for the user, not as instructions to another agent. Make every task specific,
   ordered by dependency within and across groups, and complete enough that finishing all checked
   items implements the whole request. Group tasks by the related behavior or implementation area,
   using short descriptive headings. Include tests and final validation as tasks where they are
   required for completion.

   Complete when the overview explains the complete change and the checkbox list covers every
   required behavior, error case, integration point, and verification step.

4. When the user provided a spec or ticket and has not explicitly said whether to amend it, ask
   whether the completed plan should be added to that spec or ticket description. Follow an explicit
   instruction to add it or leave it unchanged without asking again.

   Complete when the user has been given that choice or their explicit direction has been followed.
