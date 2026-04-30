---
name: saas-doc-generator
description: Generate comprehensive user documentation from SaaS codebases for non-technical audiences. Use this skill whenever a user wants to document their SaaS product, explain features, or create how-to guides based on their source code. Triggers include requests like "write documentation for my codebase," "document this feature," "write a user guide for my SaaS," "explain how to use [feature]," or "create tutorials." Perfect for creating step-by-step guides, feature overviews, how-to tutorials, troubleshooting docs, and workflow explanations. All output must be markdown files with YAML frontmatter containing title, description, category, section, and lastUpdated fields. Focus on how users accomplish tasks, not technical implementation or code.
---

# SaaS Documentation Generator

This skill helps Claude analyze SaaS codebases and generate high-quality, non-technical documentation for end users. It provides a structured workflow for understanding features, extracting user workflows, and producing clear guides that help people accomplish their goals with your software.

**Important: All documentation must be markdown files with standardized frontmatter.** Code, APIs, and technical implementation details are excluded — documentation explains what users can do and how to do it.

## When to Use This Skill

- **How-To Guides**: Step-by-step instructions for common tasks
- **Feature Overviews**: Explain what a feature does and why someone would use it
- **Quickstart/Getting Started**: Minimal steps to accomplish first meaningful task
- **Tutorials**: Walkthrough a complete workflow or use case
- **Troubleshooting Guides**: Common problems and how to solve them
- **Workflow Explanations**: How different features work together to accomplish goals

## Key Principles

### 1. Start with Scope Definition

Always ask the user to clarify the scope before diving into analysis:

- **What to document?** Single feature? Entire product? Specific workflow?
- **Who's the audience?** End users? Specific role (marketing managers, event organizers)?
- **Category?** Tutorial? Guide? Reference? Troubleshooting? (used in frontmatter)
- **Section?** What documentation section does this belong in? (used in frontmatter)
- **Existing docs style?** Match existing tone, structure, or template?

### 2. Feature Analysis Strategy

**For Feature Documentation:**

1. Understand what the feature does from user perspective (not how it's coded)
2. Identify who would use this feature and when
3. Extract the workflow: what steps does a user follow?
4. Note prerequisites, options, and settings users can control
5. Identify common mistakes or gotchas
6. Find UI elements, buttons, screens involved
7. Document the outcome: what does the user accomplish?

**For Workflow/Integration Guides:**

1. Trace the complete user workflow (steps a user takes)
2. Identify decision points (when would a user choose option A vs B?)
3. Show how different features work together
4. Note dependencies (what needs to be set up first?)
5. Document expected outcomes at each step

### 3. Documentation Structure

Build documentation in this order:

```
1. Overview/Introduction
   - What is this feature? (1-2 sentences, user-focused)
   - Why would someone use it? (benefits/use cases)
   - What will you be able to do?

2. Before You Start (if needed)
   - Prerequisites or setup required
   - Permissions or roles needed
   - Related features they should know about

3. Step-by-Step Guide
   - Clear numbered steps
   - Where to find each button/option (describe location)
   - What you'll see at each step
   - Screenshots/descriptions of UI

4. Key Options & Settings (if applicable)
   - What each option does (explain in plain language)
   - When you'd use each option
   - Default vs. recommended settings

5. Common Tasks/Variations
   - Different ways to accomplish similar goals
   - When to use each approach
   - Tips for common scenarios

6. Troubleshooting
   - What can go wrong
   - How to fix it
   - Where to find help

7. Next Steps
   - What to do after completing this task
   - Related features to explore
   - Tips for getting more value
```

### 4. Writing Quality

**Clarity over completeness:**

- Assume audience is smart but non-technical
- Define acronyms and specialized terms on first use
- Use short sentences and paragraphs
- Break up text with headers, lists, and white space
- Use conversational language, not jargon
- Explain the "why" not just the "how"

**Accuracy:**

- Every feature described should actually exist in the software
- Every step should match the actual UI/workflow
- Every option/setting should be real and user-controllable
- Call out deprecated or experimental features clearly
- Test UI descriptions against the actual interface

**Tone:**

- Match the product's voice (professional? friendly? approachable?)
- Be consistent throughout
- Use second person ("you") to address the reader
- Be honest about limitations and edge cases
- Use encouraging language ("Here's how..." not "You must...")

## Markdown & Frontmatter Requirements

**Every documentation file must be a markdown (.md) file with YAML frontmatter.**

### Required Frontmatter Fields

Every markdown file must start with this frontmatter block:

```yaml
---
title: "Feature Name or Topic"
description: "1-2 sentence summary of what this doc covers and who it's for"
category: "tutorial|guide|reference|troubleshooting|overview"
section: "Name of documentation section (e.g., 'library', 'library-management', 'worship-planning')"
lastUpdated: "YYYY-MM-DD"
---
```

**Field Definitions:**

- `title`: Clear, descriptive title that appears as the document title
- `description`: Brief summary that helps users find the right doc; appears in documentation indexes
- `category`: One of: `tutorial` (step-by-step walkthrough), `guide` (how-to), `reference` (lookup), `troubleshooting` (fixing problems), `overview` (feature explanation)
- `section`: Logical grouping/section this doc belongs to (ask user for their section structure)
- `lastUpdated`: Date doc was written/updated (YYYY-MM-DD format)

### Example Frontmatter

```yaml
---
title: "Building A Reusable Church Media Library"
description: "How Cloud of Worship helps churches save songs, slides, and useful content for reuse across services and events."
category: "tutorial"
section: "library"
lastUpdated: "2026-04-30"
---
```

### What Comes After Frontmatter

After the frontmatter, write the documentation in standard markdown format. Start with the main heading (# Title) and organize with subsequent headings, bullet points, numbered lists, bold/italic text, etc.

## Workflow

### Phase 1: Interview & Scoping

1. Ask which feature or workflow to document
2. Identify the target audience (who will use this doc?)
3. Confirm the documentation section/category
4. Ask about existing documentation style to match

### Phase 2: Codebase Analysis

1. Review uploaded files to understand the feature
2. Trace the user workflow (steps users take, not code structure)
3. Identify UI elements, buttons, screens, and navigation
4. Note options, settings, and choices users can make
5. Find edge cases, common mistakes, or gotchas
6. Understand prerequisites and dependencies from user perspective

### Phase 3: Documentation Draft

1. Create markdown file with frontmatter
2. Write overview/introduction first
3. Add "Before You Start" section if needed
4. Write step-by-step guides with clear numbered steps
5. Document options and settings in plain language
6. Add troubleshooting section
7. Include "Next Steps" section

### Phase 4: Review & Iteration

1. Share draft with user
2. Ask for feedback on:
   - Accuracy (does it match the actual software?)
   - Clarity (is it understandable by the target audience?)
   - Completeness (anything important missing?)
   - Tone (does it match your brand voice?)
3. Revise based on feedback
4. Update lastUpdated date in frontmatter

### Phase 5: Deliver

1. Save as clean markdown file
2. Provide file ready for integration into docs system
3. Confirm frontmatter is complete and accurate

## Section Structure Considerations

Ask the user: **How do you organize your documentation sections?**

Examples might include:

- By product area: `getting-started`, `library`, `worship-planning`, `team-collaboration`
- By user role: `worship-leader`, `administrator`, `volunteer`, `pastor`
- By workflow: `preparing-for-sunday`, `managing-resources`, `sharing-content`
- Hybrid: `library-creation`, `library-management`, `library-sharing`

## Common Challenges & Solutions

| Challenge                          | Solution                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| UI changed but code hasn't         | Document what currently exists in the software; flag for verification with product team                                |
| Feature has many options           | Focus on common cases first; explain when/why to use each option; prioritize 80/20                                     |
| Users don't understand the purpose | Lead with "why" before "how"; explain benefits and use cases; show real-world example workflows                        |
| Feature is complex with many steps | Break into smaller how-to docs for common tasks; cross-reference related docs; add troubleshooting for each major step |
| Terminology unclear                | Define terms in plain language on first use; avoid jargon; use consistent terminology throughout                       |
| Multiple ways to do same thing     | Explain each approach; note when to use which; recommended vs. alternative methods                                     |

## Output Format

**All documentation is delivered as markdown files (.md) with YAML frontmatter.**

Markdown is ideal because it:

- Is human-readable and easy to edit
- Integrates with most documentation platforms and wikis
- Can be version-controlled alongside your codebase
- Can be easily converted to other formats (HTML, PDF) if needed
- Works for both technical and non-technical audiences
- Keeps content focused and simple

**File Organization:**

- One main topic per file
- Descriptive filenames (e.g., `create-media-library.md`, `managing-songs.md`)
- Group related files by section
- Use the `section` frontmatter field to organize categorically

## Tips for Success

1. **Start focused**: Document one feature or workflow well rather than trying to cover everything
2. **User perspective**: Always ask "how does a user do this?" not "how does the code work?"
3. **Be specific**: Say "click the blue 'Save' button at the top right" not "save your work"
4. **Test your steps**: Follow the steps yourself to ensure they actually work in the software
5. **Get feedback early**: Share drafts with actual users or customer support before finalizing
6. **Use headings liberally**: Make it scannable; users search and skim documentation
7. **Short paragraphs**: Keep content digestible; break up long text blocks
8. **Explain the why**: Help users understand not just how to do something, but why they'd do it
9. **Update regularly**: Keep `lastUpdated` date current; revisit docs when features change

## Common Documentation Topics

**Getting Started:**

- First steps/initial setup
- What you can accomplish overview
- Where to find things

**Feature How-Tos:**

- How to [create/manage/use feature]
- Common workflows
- Different ways to accomplish goals

**Troubleshooting:**

- What can go wrong
- How to recognize problems
- Step-by-step solutions
- When to contact support

**Explanations:**

- What is this feature?
- Why would I use this?
- How does it fit with other features?
- What are the benefits?

## What to Ask the User

Before starting documentation:

- [ ] Which feature(s) or workflow(s) to document?
- [ ] Who is the primary audience? (role or user type)
- [ ] What category? (tutorial / guide / reference / troubleshooting / overview)
- [ ] What section? (how is documentation organized?)
- [ ] How many users have asked about this?
- [ ] What problems or questions do they have?
- [ ] Is there existing documentation to match style-wise?
- [ ] Today's date for the lastUpdated field?
