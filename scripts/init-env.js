import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found. Please create it and add VITE_ANTHROPIC_API_KEY.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && v) acc[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
  return acc;
}, {} as Record<string, string>);

const apiKey = envVars['VITE_ANTHROPIC_API_KEY'];

if (!apiKey || apiKey.startsWith('sk-ant-your_key')) {
  console.error('❌ Invalid or missing VITE_ANTHROPIC_API_KEY in .env');
  process.exit(1);
}

async function main() {
  console.log('🚀 Creating Anthropic Managed Environment for Trading Journal Analyst...');
  const res = await fetch('https://api.anthropic.com/v1/environments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'managed-agents-2026-04-01'
    },
    body: JSON.stringify({
      name: 'trading-journal-env',
      description: 'Compute environment for the Trading Journal Analyst — runs pandas, matplotlib, and file I/O for trade log analysis.',
      metadata: {},
      scope: 'organization',
      config: {
        type: 'cloud',
        packages: {
          pip: ['pandas', 'matplotlib', 'numpy'],
          npm: [], apt: [], cargo: [], gem: [], go: []
        },
        networking: { type: 'limited', allow_mcp_servers: false, allow_package_managers: true, allowed_hosts: [] }
      }
    })
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    console.error('❌ API Error:', data);
    process.exit(1);
  }
  
  console.log('✅ Environment created successfully:', data.id);
  
  // Append to .env
  fs.appendFileSync(envPath, `\nVITE_ANTHROPIC_ENV_ID=${data.id}\n`);
  console.log('✅ Added VITE_ANTHROPIC_ENV_ID to .env. You can now use the `/analyze` command in the app!');
}

main().catch(console.error);
