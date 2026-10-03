import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Laravel API from Scratch',
  description: 'Web fundamentals, Laravel basics, and building a secure Laravel API step by step',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: 'Fundamentals', link: '/fundamentals/how-the-web-works' },
      { text: 'Start', link: '/start/prerequisites' },
      { text: 'Build the foundations', link: '/foundations/' },
      { text: 'Create a module', link: '/guides/creating-a-module' },
    ],

    sidebar: [
      {
        text: '1. Fundamentals',
        collapsed: false,
        items: [
          { text: 'How the web works', link: '/fundamentals/how-the-web-works' },
          { text: 'Web programming basics', link: '/fundamentals/web-programming-basics' },
          { text: 'The web development workflow', link: '/fundamentals/web-development-workflow' },
          { text: 'Databases & SQL', link: '/fundamentals/databases-and-sql' },
          { text: 'RESTful APIs', link: '/fundamentals/restful-apis' },
          { text: 'Full-stack architectures', link: '/fundamentals/full-stack' },
          { text: 'Security basics', link: '/fundamentals/security-basics' },
        ],
      },
      {
        text: '2. Start a project',
        collapsed: false,
        items: [
          { text: 'Prerequisites', link: '/start/prerequisites' },
          { text: 'Create the project', link: '/start/create-project' },
          { text: 'Configure the environment', link: '/start/configure-environment' },
          { text: 'Tour of a fresh app', link: '/start/tour-of-a-fresh-app' },
        ],
      },
      {
        text: '3. Laravel basics',
        collapsed: true,
        items: [
          { text: 'Routing', link: '/laravel-basics/routing' },
          { text: 'Controllers', link: '/laravel-basics/controllers' },
          { text: 'Validation & form requests', link: '/laravel-basics/validation' },
          { text: 'Eloquent: models & migrations', link: '/laravel-basics/eloquent' },
          { text: 'API resources', link: '/laravel-basics/api-resources' },
          { text: 'Middleware', link: '/laravel-basics/middleware' },
          { text: 'Service container', link: '/laravel-basics/service-container' },
          { text: 'Config & environment', link: '/laravel-basics/config-and-env' },
          { text: 'Seeding', link: '/laravel-basics/seeding' },
          { text: 'Transactions', link: '/laravel-basics/transactions' },
          { text: 'Blade templates', link: '/laravel-basics/blade' },
          { text: 'Testing with Pest', link: '/laravel-basics/testing' },
        ],
      },
      {
        text: '4. Build the foundations',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/foundations/' },
          { text: '01 Folder conventions', link: '/foundations/01-folder-conventions' },
          { text: '02 Route auto-loading', link: '/foundations/02-route-autoloading' },
          { text: '03 Responses & errors', link: '/foundations/03-responses-and-errors' },
          { text: '04 make:service', link: '/foundations/04-make-service' },
          { text: '05 Query traits', link: '/foundations/05-query-traits' },
          { text: '06 Activity log', link: '/foundations/06-activity-log' },
          { text: '07 Roles & users', link: '/foundations/07-roles-and-users' },
          { text: '08 JWT access tokens', link: '/foundations/08-jwt-access-tokens' },
          { text: '09 Refresh sessions', link: '/foundations/09-refresh-sessions' },
          { text: '10 Permissions (RBAC)', link: '/foundations/10-rbac' },
          { text: '11 API docs (Scramble)', link: '/foundations/11-api-docs' },
          { text: '12 File uploads', link: '/foundations/12-file-uploads' },
          { text: '13 CORS & rate limits', link: '/foundations/13-cors-and-rate-limits' },
        ],
      },
      {
        text: '5. Guides',
        collapsed: true,
        items: [
          { text: 'Creating a module', link: '/guides/creating-a-module' },
          { text: 'A Blade (full-stack) module', link: '/guides/blade-module' },
          { text: 'Search, filter & sort', link: '/guides/search-filter-sort' },
          { text: 'Seeding permissions', link: '/guides/seeding-rbac' },
          { text: 'Artisan commands', link: '/guides/artisan-commands' },
        ],
      },
      {
        text: '6. Architecture',
        collapsed: true,
        items: [
          { text: 'Request lifecycle', link: '/architecture/request-lifecycle' },
          { text: 'Responses & errors', link: '/architecture/responses-and-errors' },
          { text: 'Authentication', link: '/architecture/authentication' },
          { text: 'Authorization', link: '/architecture/authorization' },
          { text: 'Activity logging', link: '/architecture/activity-logging' },
        ],
      },
      {
        text: '7. Operations',
        collapsed: true,
        items: [
          { text: 'Deployment checklist', link: '/operations/deployment' },
          { text: 'Troubleshooting', link: '/operations/troubleshooting' },
        ],
      },
      {
        text: 'Reference',
        collapsed: true,
        items: [
          { text: 'Conventions', link: '/reference/conventions' },
          { text: 'Helpers', link: '/reference/helpers' },
          { text: 'API reference', link: '/reference/api' },
          { text: 'Glossary', link: '/reference/glossary' },
        ],
      },
    ],

    search: { provider: 'local' },
    outline: [2, 3],
  },
})
