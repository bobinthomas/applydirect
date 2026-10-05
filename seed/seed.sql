-- Seed. Apply after 0001_init.sql:
--   npx wrangler d1 execute direct-apply --remote --file=seed/seed.sql
-- Company tokens below are starting points, not a verified list. The harvester
-- deactivates any board that 404s or fails four times, so wrong guesses cost
-- one request and then disappear. Discovery grows the real list.

INSERT OR REPLACE INTO profiles (id, name, version, resume_md, config_json) VALUES (
  'me',
  'Bobin',
  1,
  'REPLACE_WITH_seed/profile.md',
  json('{
    "titles": {
      "core": [
        "senior product designer","lead product designer","staff product designer",
        "principal product designer","design systems designer","design engineer",
        "ai ux","ux engineer","product design lead","senior ux designer",
        "lead ux designer","design technologist"
      ],
      "adjacent": [
        "senior designer","ux architect","interaction designer","platform designer",
        "systems designer","frontend designer","head of design","design manager",
        "product designer"
      ],
      "exclude": [
        "graphic designer","motion designer","brand designer","marketing designer",
        "visual designer","game designer","industrial designer","ux researcher",
        "user researcher","instructional designer","recruiter","sales"
      ]
    },
    "seniority": {
      "want": ["senior","lead","staff","principal","head of","director"],
      "reject": ["intern","internship","junior","graduate","trainee","apprentice","associate","entry level"]
    },
    "mustHave": [
      "design system","component library","design tokens","accessibility","wcag",
      "figma","react","typescript","prototype","enterprise","b2b","saas",
      "ai","llm","agent","workflow","end to end"
    ],
    "niceToHave": [
      "fintech","healthcare","erp","procurement","multi-tenant","dashboard",
      "next.js","tailwind","storybook","design engineering","0 to 1","data visualization"
    ],
    "dealbreakers": [
      "unpaid","commission only","must relocate to","security clearance required"
    ],
    "locations": {
      "allow": ["remote","india","bengaluru","bangalore","anywhere","global","emea","apac"],
      "remoteOk": true
    },
    "weights": {
      "title": 0.34, "keywords": 0.26, "seniority": 0.22, "recency": 0.18,
      "semantic": 0.25, "judge": 0.45
    },
    "judgeTopN": 30,
    "semanticTopN": 80
  }')
);

-- Discovery queries. These are the bench strings, retargeted at the profile above.
INSERT OR REPLACE INTO queries (id, label, channel, q) VALUES
 ('gh-design','Greenhouse, senior product design','greenhouse',
  'site:job-boards.greenhouse.io OR site:boards.greenhouse.io ("Senior Product Designer" OR "Staff Product Designer" OR "Design Systems") ("Remote" OR "India")'),
 ('gh-designeng','Greenhouse, design engineering','greenhouse',
  'site:job-boards.greenhouse.io OR site:boards.greenhouse.io ("Design Engineer" OR "UX Engineer" OR "Design Technologist")'),
 ('lever-design','Lever, senior product design','lever',
  'site:jobs.lever.co ("Senior Product Designer" OR "Lead Product Designer" OR "Design Systems")'),
 ('ashby-design','Ashby, product design and AI','ashby',
  'site:jobs.ashbyhq.com ("Product Designer" OR "Design Engineer") ("Senior" OR "Staff" OR "Lead")'),
 ('ashby-ai','Ashby, AI product surfaces','ashby',
  'site:jobs.ashbyhq.com ("AI" OR "Agent") ("Product Designer" OR "Design Engineer")'),
 ('workable-design','Workable, senior design','workable',
  'site:apply.workable.com ("Senior Product Designer" OR "Lead UX Designer")'),
 ('smart-design','SmartRecruiters, senior design','smartrecruiters',
  'site:jobs.smartrecruiters.com ("Senior Product Designer" OR "Lead Product Designer")'),
 ('ds-ownership','Any board, design system ownership','greenhouse',
  '(site:job-boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com) "design system" ("Senior" OR "Lead" OR "Staff") -intern -junior');

-- Starter boards.
INSERT OR IGNORE INTO companies (id, name, ats, board_token, careers_url, discovered_by) VALUES
 ('greenhouse:figma','Figma','greenhouse','figma','https://job-boards.greenhouse.io/figma','seed'),
 ('greenhouse:notion','Notion','greenhouse','notion','https://job-boards.greenhouse.io/notion','seed'),
 ('greenhouse:stripe','Stripe','greenhouse','stripe','https://job-boards.greenhouse.io/stripe','seed'),
 ('greenhouse:airbnb','Airbnb','greenhouse','airbnb','https://job-boards.greenhouse.io/airbnb','seed'),
 ('greenhouse:doordash','DoorDash','greenhouse','doordash','https://job-boards.greenhouse.io/doordash','seed'),
 ('greenhouse:gitlab','GitLab','greenhouse','gitlab','https://job-boards.greenhouse.io/gitlab','seed'),
 ('greenhouse:dropbox','Dropbox','greenhouse','dropbox','https://job-boards.greenhouse.io/dropbox','seed'),
 ('greenhouse:coinbase','Coinbase','greenhouse','coinbase','https://job-boards.greenhouse.io/coinbase','seed'),
 ('greenhouse:databricks','Databricks','greenhouse','databricks','https://job-boards.greenhouse.io/databricks','seed'),
 ('greenhouse:discord','Discord','greenhouse','discord','https://job-boards.greenhouse.io/discord','seed'),
 ('greenhouse:plaid','Plaid','greenhouse','plaid','https://job-boards.greenhouse.io/plaid','seed'),
 ('greenhouse:reddit','Reddit','greenhouse','reddit','https://job-boards.greenhouse.io/reddit','seed'),
 ('greenhouse:twilio','Twilio','greenhouse','twilio','https://job-boards.greenhouse.io/twilio','seed'),
 ('greenhouse:asana','Asana','greenhouse','asana','https://job-boards.greenhouse.io/asana','seed'),
 ('greenhouse:brex','Brex','greenhouse','brex','https://job-boards.greenhouse.io/brex','seed'),
 ('greenhouse:grammarly','Grammarly','greenhouse','grammarly','https://job-boards.greenhouse.io/grammarly','seed'),
 ('greenhouse:hashicorp','HashiCorp','greenhouse','hashicorp','https://job-boards.greenhouse.io/hashicorp','seed'),
 ('greenhouse:mongodb','MongoDB','greenhouse','mongodb','https://job-boards.greenhouse.io/mongodb','seed'),
 ('greenhouse:samsara','Samsara','greenhouse','samsara','https://job-boards.greenhouse.io/samsara','seed'),
 ('greenhouse:sentry','Sentry','greenhouse','sentry','https://job-boards.greenhouse.io/sentry','seed'),
 ('greenhouse:webflow','Webflow','greenhouse','webflow','https://job-boards.greenhouse.io/webflow','seed'),
 ('greenhouse:postman','Postman','greenhouse','postman','https://job-boards.greenhouse.io/postman','seed'),
 ('greenhouse:instacart','Instacart','greenhouse','instacart','https://job-boards.greenhouse.io/instacart','seed'),
 ('greenhouse:affirm','Affirm','greenhouse','affirm','https://job-boards.greenhouse.io/affirm','seed'),
 ('greenhouse:flexport','Flexport','greenhouse','flexport','https://job-boards.greenhouse.io/flexport','seed'),
 ('ashby:openai','OpenAI','ashby','openai','https://jobs.ashbyhq.com/openai','seed'),
 ('ashby:anthropic','Anthropic','ashby','anthropic','https://jobs.ashbyhq.com/anthropic','seed'),
 ('ashby:linear','Linear','ashby','linear','https://jobs.ashbyhq.com/linear','seed'),
 ('ashby:ramp','Ramp','ashby','ramp','https://jobs.ashbyhq.com/ramp','seed'),
 ('ashby:vanta','Vanta','ashby','vanta','https://jobs.ashbyhq.com/vanta','seed'),
 ('ashby:posthog','PostHog','ashby','posthog','https://jobs.ashbyhq.com/posthog','seed'),
 ('ashby:replit','Replit','ashby','replit','https://jobs.ashbyhq.com/replit','seed'),
 ('ashby:anysphere','Cursor','ashby','anysphere','https://jobs.ashbyhq.com/anysphere','seed'),
 ('lever:palantir','Palantir','lever','palantir','https://jobs.lever.co/palantir','seed'),
 ('lever:netflix','Netflix','lever','netflix','https://jobs.lever.co/netflix','seed');
