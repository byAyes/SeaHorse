/**
 * Job Analyzer
 *
 * Analyzes job descriptions and titles to extract skills, category, and salary
 * so the matching engine can compute real (not neutral) scores.
 *
 * This runs AFTER scraping, enriching the minimal scraped job data with
 * structured fields extracted from the description text.
 */

// ─── Comprehensive Skill Catalog ───────────────────────────────────────────

const SKILL_CATALOG = new Map<string, string[]>([
  // ── Programming Languages ────────────────────────────────────────────────
  ['javascript', ['javascript', 'js', 'ecmascript', 'es6', 'es2015']],
  ['typescript', ['typescript', 'ts']],
  ['python', ['python']],
  ['java', ['java']],
  ['c#', ['c#', 'csharp', 'c sharp', '.net']],
  ['c++', ['c++', 'cpp', 'c plus plus']],
  ['c', ['c language', 'c programming', 'ansi c']],
  ['go', ['go', 'golang']],
  ['rust', ['rust']],
  ['ruby', ['ruby']],
  ['php', ['php']],
  ['swift', ['swift']],
  ['kotlin', ['kotlin']],
  ['scala', ['scala']],
  ['dart', ['dart']],
  ['sql', ['sql']],
  ['r', ['r language', 'r programming']],
  ['bash', ['bash', 'shell script', 'shell scripting']],
  ['perl', ['perl']],
  ['haskell', ['haskell']],
  ['elixir', ['elixir']],
  ['clojure', ['clojure']],
  ['groovy', ['groovy']],
  ['lua', ['lua']],
  ['objective-c', ['objective-c', 'objective c', 'objc']],
  ['julia', ['julia']],
  ['solidity', ['solidity']],
  ['zig', ['zig']],
  ['assembly', ['assembly', 'asm']],
  ['fortran', ['fortran']],
  ['cobol', ['cobol']],

  // ── Frontend Frameworks & Libraries ─────────────────────────────────────
  ['react', ['react', 'reactjs', 'react.js', 'react js']],
  ['next.js', ['next.js', 'nextjs', 'next js']],
  ['angular', ['angular', 'angular.js', 'angularjs', 'angular 2+']],
  ['vue', ['vue', 'vue.js', 'vuejs', 'vue js']],
  ['svelte', ['svelte']],
  ['remix', ['remix', 'remix.run']],
  ['gatsby', ['gatsby', 'gatsby.js']],
  ['nuxt.js', ['nuxt', 'nuxt.js', 'nuxtjs']],
  ['astro', ['astro']],
  ['preact', ['preact']],
  ['htmx', ['htmx']],
  ['alpine.js', ['alpine.js', 'alpinejs', 'alpine js']],
  ['jquery', ['jquery']],
  ['html', ['html', 'html5']],
  ['css', ['css', 'css3', 'css 3']],
  ['tailwind', ['tailwind', 'tailwind css']],
  ['bootstrap', ['bootstrap']],
  ['sass', ['sass', 'scss']],
  ['less', ['less']],
  ['redux', ['redux', 'reduxjs']],
  ['zustand', ['zustand']],
  ['mobx', ['mobx']],
  ['recoil', ['recoil']],
  ['jotai', ['jotai']],
  ['tanstack query', ['tanstack query', 'react query', 'react-query']],
  ['tanstack table', ['tanstack table', 'react table', 'react-table']],
  ['tanstack router', ['tanstack router']],
  ['react router', ['react router', 'react-router']],
  ['graphql', ['graphql', 'graph ql', 'gql']],
  ['apollo', ['apollo', 'apollo client', 'apollo server']],
  ['material ui', ['material ui', 'mui', 'material design']],
  ['chakra ui', ['chakra ui', 'chakra']],
  ['shadcn/ui', ['shadcn', 'shadcn/ui', 'shadcn ui']],
  ['radix ui', ['radix ui', 'radix']],
  ['emotion', ['emotion']],
  ['styled-components', ['styled-components', 'styled components']],
  ['framer motion', ['framer motion', 'framer-motion']],
  ['storybook', ['storybook']],
  ['eslint', ['eslint']],
  ['prettier', ['prettier']],
  ['postcss', ['postcss']],
  ['webpack', ['webpack']],
  ['vite', ['vite']],
  ['rollup', ['rollup']],
  ['esbuild', ['esbuild']],
  ['babel', ['babel']],
  ['swc', ['swc']],
  ['chart.js', ['chart.js', 'chartjs', 'chart js']],
  ['d3.js', ['d3.js', 'd3js', 'd3', 'd3 js']],
  ['three.js', ['three.js', 'threejs', 'three js']],
  ['recharts', ['recharts']],
  ['leaflet', ['leaflet']],
  ['mapbox', ['mapbox', 'mapbox gl']],

  // ── Backend Frameworks & Runtimes ───────────────────────────────────────
  ['node.js', ['node.js', 'nodejs', 'node', 'node js']],
  ['express', ['express', 'express.js', 'expressjs']],
  ['nestjs', ['nestjs', 'nest.js', 'nest js']],
  ['deno', ['deno']],
  ['bun', ['bun']],
  ['django', ['django']],
  ['flask', ['flask']],
  ['fastapi', ['fastapi']],
  ['spring', ['spring', 'spring boot', 'spring framework', 'spring mvc']],
  ['rails', ['ruby on rails', 'rails']],
  ['asp.net', ['asp.net', 'aspnet', '.net core', 'dotnet', 'dotnet core']],
  ['laravel', ['laravel']],
  ['koa', ['koa', 'koa.js', 'koajs']],
  ['socket.io', ['socket.io', 'socketio', 'socket io']],
  ['hasura', ['hasura']],
  ['rabbitmq', ['rabbitmq', 'rabbit mq']],
  ['nats', ['nats']],
  ['celery', ['celery']],
  ['stripe', ['stripe']],
  ['sentry', ['sentry']],

  // ── Cloud & Infrastructure ─────────────────────────────────────────────
  ['aws', ['aws', 'amazon web services']],
  ['ec2', ['ec2']],
  ['s3', ['s3']],
  ['lambda', ['lambda', 'aws lambda']],
  ['ecs', ['ecs', 'amazon ecs', 'fargate']],
  ['eks', ['eks', 'amazon eks']],
  ['ecr', ['ecr']],
  ['cloudfront', ['cloudfront']],
  ['route53', ['route53', 'route 53']],
  ['api gateway', ['api gateway', 'aws api gateway', 'apigateway']],
  ['cloudformation', ['cloudformation']],
  ['sqs', ['sqs', 'amazon sqs']],
  ['sns', ['sns', 'amazon sns']],
  ['ses', ['ses', 'amazon ses']],
  ['step functions', ['step functions', 'stepfunction']],
  ['kinesis', ['kinesis', 'amazon kinesis']],
  ['cognito', ['cognito']],
  ['iam', ['iam', 'aws iam']],
  ['cloudwatch', ['cloudwatch']],
  ['cloudtrail', ['cloudtrail']],
  ['azure', ['azure', 'microsoft azure', 'azur']],
  ['azure functions', ['azure functions', 'azure function']],
  ['azure devops', ['azure devops']],
  ['azure kubernetes', ['azure kubernetes', 'aks']],
  ['azure storage', ['azure storage', 'blob storage']],
  ['gcp', ['gcp', 'google cloud', 'google cloud platform']],
  ['bigquery', ['bigquery', 'big query']],
  ['gke', ['gke', 'google kubernetes engine', 'google kubernetes']],
  ['cloud functions', ['cloud functions', 'google cloud functions']],
  ['cloud run', ['cloud run', 'google cloud run']],
  ['pub/sub', ['pub/sub', 'pubsub', 'google pubsub']],
  ['dataflow', ['dataflow', 'google dataflow']],
  ['dataproc', ['dataproc']],
  ['cloudflare', ['cloudflare', 'cloud flare']],
  ['vercel', ['vercel']],
  ['netlify', ['netlify']],
  ['heroku', ['heroku']],
  ['digitalocean', ['digitalocean', 'digital ocean']],
  ['docker', ['docker']],
  ['kubernetes', ['kubernetes', 'k8s']],
  ['terraform', ['terraform']],
  ['pulumi', ['pulumi']],
  ['helm', ['helm']],
  ['argocd', ['argocd', 'argo cd', 'argo']],
  ['istio', ['istio']],
  ['linkerd', ['linkerd']],
  ['envoy', ['envoy']],
  ['traefik', ['traefik']],
  ['vagrant', ['vagrant']],
  ['packer', ['packer']],
  ['vault', ['vault', 'hashicorp vault']],
  ['consul', ['consul']],
  ['nomad', ['nomad', 'hashicorp nomad']],
  ['ci/cd', ['ci/cd', 'ci cd', 'continuous integration', 'continuous delivery', 'continuous deployment']],
  ['jenkins', ['jenkins']],
  ['github actions', ['github actions', 'github action']],
  ['gitlab ci', ['gitlab ci', 'gitlab pipelines']],
  ['circleci', ['circleci', 'circle ci']],
  ['travis ci', ['travis ci', 'travis']],
  ['bitbucket pipelines', ['bitbucket pipelines']],

  // ── Databases ───────────────────────────────────────────────────────────
  ['postgresql', ['postgresql', 'postgres', 'psql']],
  ['mysql', ['mysql', 'mariadb']],
  ['sqlite', ['sqlite']],
  ['sql server', ['sql server', 'mssql', 'microsoft sql']],
  ['oracle', ['oracle', 'oracle db', 'oracle database']],
  ['mongodb', ['mongodb', 'mongo']],
  ['redis', ['redis']],
  ['elasticsearch', ['elasticsearch', 'elastic search', 'es']],
  ['dynamodb', ['dynamodb', 'dynamo db']],
  ['cassandra', ['cassandra', 'apache cassandra']],
  ['neo4j', ['neo4j']],
  ['cockroachdb', ['cockroachdb', 'cockroach db']],
  ['couchbase', ['couchbase']],
  ['influxdb', ['influxdb', 'influx db']],
  ['timescaledb', ['timescaledb', 'timescale db']],
  ['clickhouse', ['clickhouse']],
  ['redshift', ['redshift', 'amazon redshift']],
  ['snowflake', ['snowflake']],
  ['planetscale', ['planetscale', 'planet scale']],
  ['neon', ['neon', 'neon db']],
  ['firebase', ['firebase', 'firestore']],
  ['supabase', ['supabase']],
  ['fauna', ['fauna', 'fauna db']],
  ['prisma', ['prisma']],
  ['drizzle', ['drizzle', 'drizzle orm']],
  ['typeorm', ['typeorm', 'type orm']],
  ['sequelize', ['sequelize']],
  ['knex', ['knex', 'knex.js']],
  ['mongoose', ['mongoose']],

  // ── DevOps & Monitoring ────────────────────────────────────────────────
  ['git', ['git']],
  ['github', ['github']],
  ['gitlab', ['gitlab']],
  ['bitbucket', ['bitbucket']],
  ['linux', ['linux', 'unix', 'posix']],
  ['nginx', ['nginx']],
  ['apache', ['apache', 'apache http', 'httpd']],
  ['ansible', ['ansible']],
  ['chef', ['chef']],
  ['puppet', ['puppet']],
  ['prometheus', ['prometheus']],
  ['grafana', ['grafana']],
  ['datadog', ['datadog', 'data dog']],
  ['new relic', ['new relic', 'newrelic']],
  ['splunk', ['splunk']],
  ['elk stack', ['elk', 'elk stack', 'elastic stack']],
  ['logstash', ['logstash']],
  ['fluentd', ['fluentd']],
  ['pagerduty', ['pagerduty']],
  ['sonarqube', ['sonarqube', 'sonar']],
  ['snyk', ['snyk']],
  ['npm', ['npm']],
  ['yarn', ['yarn']],
  ['pnpm', ['pnpm']],
  ['gradle', ['gradle']],
  ['maven', ['maven', 'mvn']],

  // ── Mobile ─────────────────────────────────────────────────────────────
  ['react native', ['react native', 'reactnative']],
  ['flutter', ['flutter']],
  ['android', ['android', 'android sdk', 'android studio']],
  ['ios', ['ios', 'ios development', 'swiftui', 'uikit']],
  ['xamarin', ['xamarin']],
  ['ionic', ['ionic', 'ionic framework']],
  ['cordova', ['cordova', 'apache cordova']],
  ['capacitor', ['capacitor']],
  ['expo', ['expo']],
  ['appium', ['appium']],

  // ── Data & AI ──────────────────────────────────────────────────────────
  ['machine learning', ['machine learning', 'ml']],
  ['deep learning', ['deep learning', 'dl']],
  ['tensorflow', ['tensorflow', 'tf']],
  ['pytorch', ['pytorch', 'torch']],
  ['jax', ['jax']],
  ['hugging face', ['hugging face', 'huggingface', 'transformers']],
  ['llm', ['llm', 'large language model', 'generative ai', 'genai', 'gen ai']],
  ['openai', ['openai', 'openai api', 'gpt', 'chatgpt']],
  ['anthropic', ['anthropic', 'claude', 'claude api']],
  ['ollama', ['ollama']],
  ['langchain', ['langchain']],
  ['langgraph', ['langgraph']],
  ['llamaindex', ['llamaindex', 'llama index']],
  ['crewai', ['crewai', 'crew ai']],
  ['autogen', ['autogen', 'microsoft autogen']],
  ['rasa', ['rasa']],
  ['pandas', ['pandas']],
  ['numpy', ['numpy']],
  ['scikit-learn', ['scikit-learn', 'sklearn', 'scikit learn']],
  ['matplotlib', ['matplotlib']],
  ['seaborn', ['seaborn']],
  ['plotly', ['plotly', 'plotly dash']],
  ['jupyter', ['jupyter', 'jupyter notebook', 'jupyterlab']],
  ['streamlit', ['streamlit']],
  ['gradio', ['gradio']],
  ['airflow', ['airflow', 'apache airflow']],
  ['spark', ['spark', 'apache spark', 'pyspark']],
  ['kafka', ['kafka', 'apache kafka']],
  ['dbt', ['dbt', 'data build tool']],
  ['mlflow', ['mlflow']],
  ['kubeflow', ['kubeflow']],
  ['opencv', ['opencv']],
  ['nltk', ['nltk']],
  ['spacy', ['spacy', 'spaCy']],
  ['fast.ai', ['fast.ai', 'fastai']],
  ['chroma', ['chroma', 'chroma db']],
  ['pinecone', ['pinecone']],
  ['weaviate', ['weaviate']],
  ['qdrant', ['qdrant']],
  ['rag', ['rag', 'retrieval augmented generation']],
  ['fine-tuning', ['fine-tuning', 'fine tuning', 'finetuning']],
  ['mlops', ['mlops', 'ml ops']],
  ['tableau', ['tableau']],
  ['power bi', ['power bi', 'powerbi']],
  ['looker', ['looker']],
  ['metabase', ['metabase']],

  // ── Testing ─────────────────────────────────────────────────────────────
  ['jest', ['jest']],
  ['vitest', ['vitest']],
  ['cypress', ['cypress']],
  ['playwright', ['playwright']],
  ['pytest', ['pytest']],
  ['selenium', ['selenium']],
  ['testing library', ['testing library', 'react testing library', '@testing-library']],
  ['mocha', ['mocha']],
  ['chai', ['chai']],
  ['sinon', ['sinon']],
  ['karma', ['karma']],
  ['jasmine', ['jasmine']],
  ['cucumber', ['cucumber']],
  ['junit', ['junit']],
  ['detox', ['detox']],

  // ── Design & Collaboration ──────────────────────────────────────────────
  ['figma', ['figma']],
  ['sketch', ['sketch']],
  ['adobe xd', ['adobe xd', 'xd']],
  ['photoshop', ['photoshop', 'adobe photoshop', 'ps']],
  ['illustrator', ['illustrator', 'adobe illustrator']],
  ['indesign', ['indesign', 'adobe indesign']],
  ['canva', ['canva']],
  ['zeplin', ['zeplin']],
  ['framer', ['framer']],
  ['webflow', ['webflow']],
  ['jira', ['jira']],
  ['confluence', ['confluence']],
  ['notion', ['notion']],
  ['slack', ['slack']],
  ['teams', ['teams', 'microsoft teams']],
  ['discord', ['discord']],
  ['asana', ['asana']],
  ['trello', ['trello']],
  ['linear', ['linear']],
  ['clickup', ['clickup']],
  ['monday.com', ['monday.com', 'monday']],
  ['zoom', ['zoom']],

  // ── Security ────────────────────────────────────────────────────────────
  ['authentication', ['authentication', 'auth']],
  ['authorization', ['authorization', 'authz']],
  ['oauth', ['oauth', 'oauth2', 'oauth 2']],
  ['jwt', ['jwt', 'json web token']],
  ['sso', ['sso', 'single sign on']],
  ['saml', ['saml']],
  ['ldap', ['ldap']],
  ['okta', ['okta']],
  ['auth0', ['auth0']],
  ['keycloak', ['keycloak']],
  ['cybersecurity', ['cybersecurity', 'cyber security']],
  ['penetration testing', ['penetration testing', 'pentest', 'pen testing']],
  ['vulnerability assessment', ['vulnerability assessment', 'vulnerability scanning']],
  ['owasp', ['owasp']],
  ['encryption', ['encryption', 'cryptography']],
  ['hipaa', ['hipaa']],
  ['gdpr', ['gdpr']],
  ['soc 2', ['soc 2', 'soc2', 'soc ii']],
  ['pci dss', ['pci dss', 'pci']],
  ['firewall', ['firewall']],
  ['waf', ['waf', 'web application firewall']],

  // ── API & Architecture ──────────────────────────────────────────────────
  ['rest api', ['rest api', 'restful api', 'restful']],
  ['microservices', ['microservices', 'micro service', 'micro-service']],
  ['serverless', ['serverless']],
  ['webhooks', ['webhooks', 'webhook']],
  ['grpc', ['grpc']],
  ['websocket', ['websocket', 'web socket', 'ws']],
  ['event-driven', ['event-driven', 'event driven', 'event driven architecture']],
  ['event sourcing', ['event sourcing']],
  ['cqrs', ['cqrs']],
  ['ddd', ['ddd', 'domain driven design', 'domain-driven design']],
  ['clean architecture', ['clean architecture']],
  ['hexagonal architecture', ['hexagonal architecture']],
  ['saga pattern', ['saga', 'saga pattern']],
  ['circuit breaker', ['circuit breaker']],
  ['api gateway', ['api gateway', 'aws api gateway', 'apigateway']],
  ['rate limiting', ['rate limiting', 'rate limit']],
  ['caching', ['caching', 'cache']],
  ['cdn', ['cdn', 'content delivery network']],

  // ── Game Development ────────────────────────────────────────────────────
  ['unity', ['unity', 'unity3d', 'unity 3d']],
  ['unreal engine', ['unreal engine', 'unreal', 'ue4', 'ue5']],
  ['godot', ['godot']],
  ['blender', ['blender']],

  // ── Writing & Content ───────────────────────────────────────────────────
  ['content writing', ['content writing', 'content writer']],
  ['copywriting', ['copywriting', 'copywriter', 'copy writing']],
  ['technical writing', ['technical writing', 'technical writer']],
  ['creative writing', ['creative writing', 'creative writer']],
  ['editorial', ['editorial', 'editing', 'editor', 'copy editing', 'copyediting']],
  ['journalism', ['journalism', 'journalist', 'news writing']],
  ['storytelling', ['storytelling', 'narrative']],
  ['content strategy', ['content strategy', 'content strategist']],
  ['content marketing', ['content marketing']],
  ['blogging', ['blogging', 'blog writer']],
  ['seo writing', ['seo writing', 'seo copywriting', 'seo content']],
  ['ux writing', ['ux writing', 'ux writer', 'microcopy']],
  ['grant writing', ['grant writing', 'grant writer']],
  ['scriptwriting', ['scriptwriting', 'script writing', 'screenwriting']],
  ['ghostwriting', ['ghostwriting', 'ghost writer']],
  ['proposal writing', ['proposal writing', 'proposal writer']],
  ['resume writing', ['resume writing', 'cv writing']],
  ['proofreading', ['proofreading', 'proof reader']],
  ['translation', ['translation', 'translator', 'localization', 'l10n']],
  ['public relations', ['public relations', 'pr', 'media relations']],
  ['communications', ['communications', 'corporate communications', 'strategic communications']],
  ['brand journalism', ['brand journalism']],

  // ── Marketing & Growth ──────────────────────────────────────────────────
  ['marketing', ['marketing', 'marketer']],
  ['digital marketing', ['digital marketing']],
  ['seo', ['seo', 'search engine optimization']],
  ['sem', ['sem', 'search engine marketing', 'ppc']],
  ['social media', ['social media', 'social media management', 'social media marketing']],
  ['email marketing', ['email marketing', 'email campaigns']],
  ['growth hacking', ['growth hacking', 'growth hacker', 'growth marketing']],
  ['growth strategy', ['growth strategy', 'growth']],
  ['brand strategy', ['brand strategy', 'branding', 'brand management', 'brand manager']],
  ['brand identity', ['brand identity']],
  ['marketing automation', ['marketing automation', 'marketing automation platform']],
  ['marketing analytics', ['marketing analytics', 'marketing measurement']],
  ['crm marketing', ['crm marketing', 'customer relationship management']],
  ['campaign management', ['campaign management', 'ad campaign', 'campaign optimization']],
  ['influencer marketing', ['influencer marketing', 'influencer']],
  ['affiliate marketing', ['affiliate marketing', 'affiliate program']],
  ['product marketing', ['product marketing', 'product marketer', 'go-to-market', 'gtm']],
  ['demand generation', ['demand generation', 'demand gen']],
  ['lead generation', ['lead generation', 'lead gen']],
  ['conversion optimization', ['conversion optimization', 'conversion rate optimization', 'cro']],
  ['ab testing', ['ab testing', 'a/b testing', 'split testing']],
  ['market research', ['market research', 'market researcher', 'competitive analysis']],
  ['customer insights', ['customer insights', 'consumer insights']],
  ['community management', ['community management', 'community manager']],
  ['event marketing', ['event marketing', 'event planning', 'event management']],
  ['field marketing', ['field marketing']],
  ['performance marketing', ['performance marketing']],
  ['media buying', ['media buying', 'media buyer', 'media planning']],
  ['programmatic advertising', ['programmatic advertising', 'programmatic']],

  // ── Sales & Business Development ───────────────────────────────────────
  ['sales', ['sales', 'sales representative', 'sales rep']],
  ['business development', ['business development', 'biz dev']],
  ['account management', ['account management', 'account manager']],
  ['key account management', ['key account management', 'key account manager']],
  ['salesforce', ['salesforce', 'sfdc']],
  ['hubspot', ['hubspot']],
  ['sales strategy', ['sales strategy', 'sales planning']],
  ['b2b sales', ['b2b sales', 'b2b']],
  ['b2c sales', ['b2c sales', 'b2c']],
  ['enterprise sales', ['enterprise sales', 'enterprise account']],
  ['saas sales', ['saas sales']],
  ['consultative selling', ['consultative selling', 'solution selling']],
  ['negotiation', ['negotiation', 'negotiating']],
  ['sales operations', ['sales operations', 'sales ops']],
  ['sales enablement', ['sales enablement']],
  ['sales pipeline', ['sales pipeline', 'pipeline management']],
  ['forecasting', ['forecasting', 'sales forecasting']],
  ['cold calling', ['cold calling', 'cold outreach']],
  ['inside sales', ['inside sales']],
  ['outside sales', ['outside sales', 'field sales']],
  ['channel sales', ['channel sales', 'partner sales', 'channel partner']],
  ['customer acquisition', ['customer acquisition']],
  ['revenue operations', ['revenue operations', 'revops', 'rev ops']],
  ['crm', ['crm']],

  // ── Product & Project Management ───────────────────────────────────────
  ['product management', ['product management', 'product manager']],
  ['product strategy', ['product strategy', 'product roadmap']],
  ['product discovery', ['product discovery']],
  ['user research', ['user research', 'ux research', 'user researcher']],
  ['usability testing', ['usability testing', 'usability']],
  ['agile', ['agile', 'agile methodology']],
  ['scrum', ['scrum', 'scrum master']],
  ['kanban', ['kanban']],
  ['lean', ['lean', 'lean methodology']],
  ['project management', ['project management', 'project manager', 'pm']],
  ['program management', ['program management', 'program manager']],
  ['stakeholder management', ['stakeholder management', 'stakeholder']],
  ['risk management', ['risk management', 'risk assessment']],
  ['jira administration', ['jira administration', 'jira admin']],
  ['confluence administration', ['confluence administration']],
  ['roadmapping', ['roadmapping', 'roadmap planning']],
  ['sprint planning', ['sprint planning', 'sprint management']],
  ['backlog management', ['backlog management', 'backlog grooming', 'backlog refinement']],
  ['cross-functional leadership', ['cross-functional leadership', 'cross functional', 'cross-team collaboration']],
  ['technical project management', ['technical project management', 'technical pm', 'tpm']],

  // ── Human Resources & Talent ────────────────────────────────────────────
  ['recruiting', ['recruiting', 'recruiter', 'talent acquisition']],
  ['human resources', ['human resources', 'hr', 'hr generalist', 'hrbp']],
  ['talent management', ['talent management', 'talent development']],
  ['employee relations', ['employee relations']],
  ['compensation & benefits', ['compensation & benefits', 'comp and benefits', 'total rewards']],
  ['payroll', ['payroll']],
  ['performance management', ['performance management', 'performance review']],
  ['learning & development', ['learning & development', 'l&d', 'training & development']],
  ['onboarding', ['onboarding', 'employee onboarding']],
  ['organizational development', ['organizational development', 'org development', 'od']],
  ['diversity & inclusion', ['diversity & inclusion', 'dei', 'diversity equity inclusion']],
  ['hr analytics', ['hr analytics', 'people analytics']],
  ['workday', ['workday']],
  ['bamboohr', ['bamboohr']],
  ['culture', ['culture', 'company culture', 'employee engagement']],

  // ── Finance & Accounting ───────────────────────────────────────────────
  ['accounting', ['accounting', 'accountant', 'general ledger']],
  ['financial analysis', ['financial analysis', 'financial analyst']],
  ['financial planning', ['financial planning', 'financial planning & analysis', 'fp&a']],
  ['budgeting', ['budgeting', 'budget management']],
  ['audit', ['audit', 'auditing', 'internal audit']],
  ['tax', ['tax', 'taxation', 'tax preparation']],
  ['bookkeeping', ['bookkeeping', 'bookkeeper']],
  ['quickbooks', ['quickbooks']],
  ['xero', ['xero']],
  ['sap', ['sap']],
  ['oracle financials', ['oracle financials', 'oracle erp', 'oracle financial']],
  ['erp', ['erp', 'enterprise resource planning']],
  ['accounts payable', ['accounts payable', 'ap']],
  ['accounts receivable', ['accounts receivable', 'ar']],
  ['financial reporting', ['financial reporting', 'financial statements']],
  ['cash flow management', ['cash flow management', 'cash flow']],
  ['treasury', ['treasury', 'treasury management']],
  ['internal controls', ['internal controls', 'sox compliance', 'sox']],
  ['revenue recognition', ['revenue recognition', 'asc 606']],
  ['financial modeling', ['financial modeling', 'financial model']],
  ['valuation', ['valuation', 'business valuation']],
  ['m&a', ['m&a', 'mergers & acquisitions', 'mergers and acquisitions']],
  ['due diligence', ['due diligence']],
  ['investment banking', ['investment banking', 'investment bank']],
  ['private equity', ['private equity', 'pe']],
  ['venture capital', ['venture capital', 'vc']],
  ['corporate finance', ['corporate finance']],

  // ── Legal & Compliance ──────────────────────────────────────────────────
  ['legal', ['legal', 'law', 'attorney', 'lawyer']],
  ['compliance', ['compliance', 'compliance officer']],
  ['regulatory', ['regulatory', 'regulatory affairs']],
  ['contract management', ['contract management', 'contracts', 'contract administration']],
  ['corporate law', ['corporate law', 'corporate legal']],
  ['intellectual property', ['intellectual property', 'ip law', 'patent']],
  ['employment law', ['employment law', 'labor law']],
  ['data privacy', ['data privacy', 'privacy', 'privacy compliance']],
  ['legal research', ['legal research']],
  ['litigation', ['litigation', 'litigation support']],
  ['risk & compliance', ['risk & compliance', 'risk and compliance']],
  ['ethics', ['ethics', 'business ethics']],

  // ── Operations & Logistics ─────────────────────────────────────────────
  ['operations', ['operations', 'operations management']],
  ['supply chain', ['supply chain', 'supply chain management', 'scm']],
  ['logistics', ['logistics', 'logistics management']],
  ['inventory management', ['inventory management', 'inventory control']],
  ['warehouse', ['warehouse', 'warehouse management', 'warehousing']],
  ['procurement', ['procurement', 'sourcing', 'strategic sourcing']],
  ['vendor management', ['vendor management', 'vendor relations']],
  ['six sigma', ['six sigma']],
  ['lean manufacturing', ['lean manufacturing', 'lean production']],
  ['process improvement', ['process improvement', 'business process improvement', 'bpi']],
  ['continuous improvement', ['continuous improvement', 'kaizen']],
  ['manufacturing', ['manufacturing', 'manufacturing operations']],
  ['production planning', ['production planning', 'production management']],
  ['facilities management', ['facilities management', 'facility management']],
  ['health & safety', ['health & safety', 'hse', 'ehs', 'occupational safety']],
  ['iso 9001', ['iso 9001']],
  ['erp implementation', ['erp implementation', 'erp systems']],
  ['sap implementation', ['sap implementation']],

  // ── Customer Success & Support ──────────────────────────────────────────
  ['customer success', ['customer success', 'customer success manager', 'csm']],
  ['customer support', ['customer support', 'customer service', 'support specialist']],
  ['help desk', ['help desk', 'service desk', 'it support']],
  ['zendesk', ['zendesk']],
  ['intercom', ['intercom']],
  ['freshdesk', ['freshdesk']],
  ['customer experience', ['customer experience', 'cx']],
  ['customer retention', ['customer retention', 'retention']],
  ['customer onboarding', ['customer onboarding', 'client onboarding']],
  ['customer education', ['customer education', 'customer training']],
  ['sla management', ['sla management', 'service level agreement']],
  ['ticket management', ['ticket management', 'ticketing system']],
  ['escalation management', ['escalation management', 'escalation']],
  ['call center', ['call center', 'contact center']],
  ['customer feedback', ['customer feedback', 'nps', 'net promoter score']],
  ['churn analysis', ['churn analysis', 'churn reduction']],
  ['customer journey', ['customer journey', 'customer journey mapping', 'user journey']],
  ['client relations', ['client relations', 'client relationship']],
  ['account expansion', ['account expansion', 'upsell', 'cross-sell', 'cross sell']],

  // ── Design & Creative ───────────────────────────────────────────────────
  ['graphic design', ['graphic design', 'graphic designer']],
  ['visual design', ['visual design', 'visual designer']],
  ['ui design', ['ui design', 'ui designer', 'user interface design']],
  ['ux design', ['ux design', 'ux designer', 'user experience design']],
  ['product design', ['product design', 'product designer']],
  ['interaction design', ['interaction design', 'interaction designer', 'ixd']],
  ['motion design', ['motion design', 'motion graphics', 'motion designer']],
  ['animation', ['animation', 'animator', '2d animation', '3d animation']],
  ['illustration', ['illustration', 'illustrator']],
  ['typography', ['typography']],
  ['color theory', ['color theory']],
  ['information architecture', ['information architecture', 'ia']],
  ['design systems', ['design systems', 'design system']],
  ['design thinking', ['design thinking']],
  ['wireframing', ['wireframing', 'wireframe']],
  ['prototyping', ['prototyping', 'prototype']],
  ['design research', ['design research', 'design researcher']],
  ['design strategy', ['design strategy']],
  ['brand design', ['brand design', 'brand designer']],
  ['packaging design', ['packaging design', 'packaging']],
  ['print design', ['print design', 'print production']],
  ['editorial design', ['editorial design', 'editorial layout']],
  ['video editing', ['video editing', 'video editor', 'post-production', 'post production']],
  ['video production', ['video production', 'videography']],
  ['photography', ['photography', 'photographer']],
  ['audio production', ['audio production', 'sound design', 'audio editing']],
  ['adobe creative suite', ['adobe creative suite', 'adobe cc', 'creative cloud']],
  ['after effects', ['after effects', 'adobe after effects']],
  ['premiere pro', ['premiere pro', 'adobe premiere']],
  ['lightroom', ['lightroom', 'adobe lightroom']],
  ['final cut pro', ['final cut pro', 'final cut']],
  ['da vinci resolve', ['da vinci resolve', 'davinci resolve']],
  ['procreate', ['procreate']],
  ['invision', ['invision']],
  ['marvel', ['marvel app']],
  ['balsamiq', ['balsamiq']],
  ['miro', ['miro']],
  ['figjam', ['figjam']],
  ['abstract', ['abstract']],

  // ── Executive & Leadership ──────────────────────────────────────────────
  ['leadership', ['leadership', 'team leadership', 'people leadership']],
  ['executive leadership', ['executive leadership', 'executive management', 'c-level', 'c-suite']],
  ['people management', ['people management', 'people manager']],
  ['team building', ['team building', 'team development']],
  ['change management', ['change management', 'organizational change']],
  ['strategic planning', ['strategic planning', 'strategic management']],
  ['business strategy', ['business strategy', 'strategy', 'corporate strategy']],
  ['board management', ['board management', 'board reporting']],
  ['p&l management', ['p&l management', 'profit and loss', 'p&l responsibility']],
  ['budget management', ['budget management', 'budget ownership']],
  ['executive coaching', ['executive coaching', 'leadership coaching']],
  ['innovation', ['innovation', 'innovation management']],
  ['digital transformation', ['digital transformation', 'digital strategy']],
  ['organizational design', ['organizational design']],
  ['board of directors', ['board of directors', 'board member']],
  ['startup', ['startup', 'founder', 'co-founder', 'entrepreneurship', 'entrepreneur']],

  // ── Healthcare & Medical ────────────────────────────────────────────────
  ['nursing', ['nursing', 'registered nurse', 'rn', 'nurse practitioner']],
  ['clinical', ['clinical', 'clinical research', 'clinical trials']],
  ['medical', ['medical', 'physician', 'doctor']],
  ['pharmacy', ['pharmacy', 'pharmacist']],
  ['medical coding', ['medical coding', 'medical billing']],
  ['healthcare administration', ['healthcare administration', 'hospital administration']],
  ['public health', ['public health', 'epidemiology']],
  ['biotech', ['biotech', 'biotechnology']],
  ['pharmaceutical', ['pharmaceutical', 'pharma']],
  ['medical devices', ['medical devices', 'medical device']],
  ['telehealth', ['telehealth', 'telemedicine']],
]);

// ─── Deduplicated Canonical Names ──────────────────────────────────────────
// When the same name appears under multiple categories,
// they must use the same canonical key. These are resolved at startup.
// Currently: graphql, apollo, api gateway use identical entries across groups.

// ─── Category Inference ────────────────────────────────────────────────────

const CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  // Software Development
  { pattern: /software engineer|software developer|full.?stack|backend|frontend|web developer|front.?end|back.?end/i, category: 'Software Development' },
  { pattern: /mobile developer|ios developer|android developer|react native|flutter/i, category: 'Mobile Development' },
  { pattern: /devops|site reliability|sre|platform engineer|infrastructure|cloud engineer/i, category: 'DevOps & Infrastructure' },

  // Data & AI
  { pattern: /data scientist|data engineer|data analyst|machine learning|ml engineer|ai engineer|deep learning/i, category: 'Data & AI' },
  { pattern: /data architect|analytics engineer|business intelligence|bi engineer/i, category: 'Data & Analytics' },

  // Design
  { pattern: /ux designer|ui designer|product designer|visual designer|graphic designer|interaction designer/i, category: 'Design' },

  // Management
  { pattern: /engineering manager|tech lead|technical lead|team lead|cto|vp of engineering|director of engineering/i, category: 'Engineering Management' },
  { pattern: /product manager|product owner|program manager|project manager|scrum master/i, category: 'Product & Project Management' },

  // QA & Testing
  { pattern: /qa engineer|test engineer|quality assurance|automation engineer|sdet|quality control/i, category: 'Quality Assurance' },

  // Writing & Content
  { pattern: /writer|content|editorial|journalism|journalist|copywriter|editor|publishing|communications|pr|public relations/i, category: 'Writing & Content' },

  // Marketing & Growth
  { pattern: /marketing|marketer|growth|seo|sem|ppc|brand|social media|demand gen|lead gen|campaign/i, category: 'Marketing & Growth' },

  // Design
  { pattern: /designer|design|illustrator|ux|ui|user experience|user interface|visual design|graphic design|motion|animation|art director|creative director|video editor|videographer|photographer|creative/i, category: 'Design & Creative' },

  // Sales & Business
  { pattern: /sales|account (executive|manager)|business development|biz dev|revenue|customer success|account management|enterprise sales|b2b sales/i, category: 'Sales & Business Development' },

  // Product & Project Management
  { pattern: /product manager|project manager|program manager|product owner|scrum master|pm|technical project manager|tpm|product management/i, category: 'Product & Project Management' },

  // HR & Talent
  { pattern: /hr|human resources|recruiter|recruiting|talent acquisition|talent management|people operations|people and culture|hrbp/i, category: 'Human Resources' },

  // Finance & Accounting
  { pattern: /accountant|accounting|financial analyst|finance|audit|controller|cfo|fp.a|financial planning|treasury|tax|bookkeeping/i, category: 'Finance & Accounting' },

  // Legal & Compliance
  { pattern: /lawyer|attorney|legal|counsel|compliance|regulatory|paralegal|general counsel/i, category: 'Legal & Compliance' },

  // Operations
  { pattern: /operations|supply chain|logistics|procurement|warehouse|manufacturing|production|facilities|health safety/i, category: 'Operations & Logistics' },

  // Executive & Management
  { pattern: /ceo|cto|coo|cfo|cmo|chief|vp of|director of|head of|president|founder|co-founder|executive/i, category: 'Executive & Management' },

  // Customer Service
  { pattern: /customer support|customer service|help desk|support specialist|call center|technical support|customer success/i, category: 'Customer Service & Support' },

  // Healthcare
  { pattern: /nurse|nursing|physician|doctor|pharmacist|clinical|medical|healthcare|hospital|public health|biotech|pharma/i, category: 'Healthcare & Medical' },

  // Education
  { pattern: /teacher|professor|instructor|educator|education|academic|faculty|curriculum|training/i, category: 'Education & Training' },

  // Security
  { pattern: /security engineer|cybersecurity|penetration tester|security analyst|information security/i, category: 'Security' },

  // Support & IT
  { pattern: /technical support|it support|help desk|system administrator|network engineer/i, category: 'IT & Support' },
];

// ─── Salary Extraction Patterns ────────────────────────────────────────────

interface SalaryMatch {
  value: number;
  currency: string;
}

/**
 * Extract a numeric salary value from a salary string.
 * Handles formats like "$100K", "$100,000", "$6.500.000", "$50/hr"
 */
function parseSalaryString(salaryStr: string): SalaryMatch | null {
  const cleaned = salaryStr.replace(/[–—]/g, '-');

  // Try to extract min salary from a range (e.g., "$100K - $150K")
  const rangeMatch = cleaned.match(/\$?\s*(\d[\d.,]*)\s*(?:K|k|,000)?(?:\s*-\s*\$?\s*\d[\d.,]*\s*(?:K|k|,000)?)/);
  if (rangeMatch) {
    const raw = rangeMatch[1].replace(/[.,]/g, '');
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      // If it includes "K" or has many zeros, treat as yearly
      if (cleaned.includes('K') || cleaned.includes('k') || raw.length >= 5) {
        return { value: num * (cleaned.includes('K') || cleaned.includes('k') ? 1000 : 1), currency: 'USD' };
      }
      // South American format: $6.500.000 → 6500000 yearly
      const dotCount = (cleaned.match(/\./g) || []).length;
      if (dotCount >= 2) {
        return { value: num, currency: 'COP' };
      }
      return { value: num, currency: 'USD' };
    }
  }

  // Single value (e.g., "$100K", "$80,000")
  const singleMatch = cleaned.match(/\$?\s*(\d[\d.,]*)\s*(K|k)?/);
  if (singleMatch) {
    const raw = singleMatch[1].replace(/[.,]/g, '');
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      if (cleaned.includes('K') || cleaned.includes('k')) return { value: num * 1000, currency: 'USD' };
      if (raw.length >= 5) return { value: num, currency: 'USD' };
      const dotCount = (cleaned.match(/\./g) || []).length;
      if (dotCount >= 2) return { value: num, currency: 'COP' };
      return { value: num, currency: 'USD' };
    }
  }

  return null;
}

/**
 * Extract salary from a job description or salary field.
 * Returns the minimum salary value found (conservative estimate).
 */
export function extractSalaryFromDescription(text: string | null): number | null {
  if (!text) return null;

  // Salary patterns in order of reliability
  const patterns = [
    // Range: $100,000 – $150,000 / year
    /\$([\d,]+)\s*(?:–|—|-|to)\s*\$?([\d,]+)\s*(?:\/|per)?\s*(?:year|yr|annually|annual)/i,
    // Range: $100K – $150K
    /\$([\d]+)\s*(K|k)\s*(?:–|—|-|to)\s*\$?([\d]+)\s*(K|k)/i,
    // Range: $100,000 - $150,000
    /\$([\d,]+)\s*(?:–|—|-|to)\s*\$?([\d,]+)/i,
    // "Salary: $100K"
    /(?:salary|pay|range):\s*\$?\s*([\d,]+(?:K|k)?)/i,
    // European/South American: $6.500.000
    /\$\s*([\d]{1,3}(?:[.][\d]{3})+(?:[.,]\d+)?)/,
    // Hourly: $50/hr - $75/hr
    /\$(\d+(?:\.\d+)?)\s*(?:\/|per)\s*(?:hr|hour)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const result = parseSalaryString(match[0]);
      if (result) return result.value;
    }
  }

  return null;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Result of job analysis
 */
export interface AnalyzedJobInfo {
  skills: string[];
  category: string | null;
  salary: number | null;
}

/**
 * Analyze a job's title and description to extract structured info.
 *
 * @param title - Job title
 * @param description - Job description text
 * @returns Extracted skills, category, and salary
 */
export function analyzeJob(title: string | null, description: string | null): AnalyzedJobInfo {
  const combined = [title || '', description || ''].filter(Boolean).join(' ');

  return {
    skills: extractSkillsFromText(combined),
    category: inferCategory(title || ''),
    salary: extractSalaryFromDescription(description || null),
  };
}

/**
 * Extract skills from a combined text (title + description).
 * Uses keyword-based matching against a comprehensive skill catalog.
 */
export function extractSkillsFromText(text: string): string[] {
  if (!text || text.length < 10) return [];

  const found = new Set<string>();
  const lower = text.toLowerCase();

  for (const [skill, aliases] of SKILL_CATALOG) {
    for (const alias of aliases) {
      // Match whole words or hyphenated compounds
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`, 'i');
      if (regex.test(lower)) {
        found.add(skill);
        break;
      }
    }
  }

  return Array.from(found).sort();
}

/**
 * Infer a job category from the job title.
 */
export function inferCategory(title: string): string | null {
  if (!title) return null;

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(title)) {
      return rule.category;
    }
  }
  return null;
}

/**
 * Validate that a job URL is usable.
 */
export function isValidJobUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  // Reject obvious placeholder/empty URLs
  if (trimmed.includes('example.com') || trimmed.includes('placeholder')) return false;
  return true;
}
