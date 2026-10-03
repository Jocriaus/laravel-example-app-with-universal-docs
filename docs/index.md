---
layout: home

hero:
  name: Laravel API from Scratch
  text: From "what is HTTP?" to a secure Laravel API
  tagline: Learn the web fundamentals, the Laravel basics, then build a production-style API step by step. No boilerplate needed.
  actions:
    - theme: brand
      text: Start with the fundamentals
      link: /fundamentals/how-the-web-works
    - theme: alt
      text: I know the basics, create the project
      link: /start/prerequisites

features:
  - title: 1. Fundamentals
    details: How the web works, HTML/CSS/JS, databases, REST, full-stack architectures and security, explained for beginners.
  - title: 2–3. Laravel basics
    details: Install Laravel and learn routing, controllers, validation, Eloquent, resources, middleware, Blade and testing.
  - title: 4. Foundations
    details: Build the base layer yourself, in 13 small steps. JWT with refresh sessions, permissions, activity log, API docs.
  - title: 5. Modules
    details: The controller → service → request → resource pattern for every feature, as an API and as Blade pages.
---

## How to use these docs

| You are... | Read |
|---|---|
| New to web development | Everything, in sidebar order |
| A developer new to Laravel | [Start a project](/start/prerequisites), then [Laravel basics](/laravel-basics/routing) |
| Comfortable with Laravel | [Build the foundations](/foundations/), then [Creating a module](/guides/creating-a-module) |
| Joining a project that already has the foundations | [Architecture](/architecture/request-lifecycle) and [Conventions](/reference/conventions) |

## What you will build

A **Laravel 13 JSON API** (it also works on Laravel 12) with:

- **Accounts and login:** short-lived JWT access tokens, rotating refresh tokens in an httpOnly cookie, logout on one or all devices.
- **Permissions:** users belong to groups; groups are allowed actions (View, Create, ...) on screens ("sub-modules").
- **An audit trail:** every change is written to an activity log.
- **Interactive API docs:** generated from the code.
- **One pattern for every feature:** route → form request → controller → service → resource.

and, optionally, **Blade pages** that reuse the same services for a server-rendered admin screen.

::: tip Every page is hands-on
Pages in *Start*, *Foundations* and *Guides* end with a **Check it works** step. Don't move on until it passes: every later step builds on the earlier ones.
:::
