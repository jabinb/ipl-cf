# Cloudflare IPL backend

This is a re-implementation of the UltimaIPL C# backend service using Cloudflare Workers.

### Improvements

- Runs inside of Cloudflare using [Cloudflare Workers](https://www.cloudflare.com/developer-platform/workers/)
  - Serverless, runs at the Edge (close to users meaning low-latency)
  - Removes pressure from your Shards server/doesn't require another server to run just the IPL backend
  - Scales infinitely to as many users as you need
  - [DDoS protected](https://www.cloudflare.com/ddos/)
  - Custom firewall rules via [Cloudflare's WAF](https://developers.cloudflare.com/waf/) allow you to block bad traffic as needed
- Uses Cloudflare R2 as the storage backend
  - Faster file downloads
  - Cheap bandwidth pricing

## Considerations before using
_Note: It's unlikely you will ever need more than Cloudflare's Free plan unless your shard is very popular (several hundred population)_

- [Free plan for Cloudflare Workers includes 100K requests per/day](https://developers.cloudflare.com/workers/platform/pricing/)
  - This can get exhausted quickly if your shard is popular, each download is 1 request
  - It costs $5 p/month for 10 Million requests, $0.5 per extra 1M requests
- [Free plan for Cloudflare R2 includes 10M Class B operations and 10GB storage](https://developers.cloudflare.com/r2/pricing/)
  - Class B operations are essentially "read" operations, like downloading a file, 10 million Class B requests essentially means 10 million downloads a month
    - It costs $4.50 p/million requests after the 10M
  - Free storage includes 10GB (way less than a typical install) so this should be a non-issue

## Cloudflare Setup

**Prerequisites**
- An existing UltimaIPL client to point to the new backend. 
- Cloudflare account, with a domain attached.
- A folder on your PC containing all your UO assets.
- [NodeJS 18+](https://nodejs.org/en/download) installed

**Steps**
1. Fork/Clone this repository
2. Run in a terminal in the cloned directory `npm install`
3. Create a R2 bucket called `ipl-content`
4. Create a Worker called `ipl-worker-production`
   - Navigate to `Custom Domains` and add a subdomain (for example: `ipl.myshard.com`)  
     _Note: this is not instant, and will take some time for Cloudflare to complete_
5. Create a KV namespace called `ipl-kv`
6. Open `wrangler.toml`
   - Update the `CONTENT_KV` namespace binding `id` to the one you just created
   - Update the `SHARD_NAME` to be your shards short name or abbreviation, do not use spaces/symbols.  
     Example: `SHARD_NAME = "StygianAbyss"` **do not do this:** `SHARD_NAME = "The Stygian Abyss"`
7. Open a terminal (command prompt) in the cloned directory (from step 1) on your PC
8. In the terminal run:
   - `npm install`
   - `npm run deploy`
     - If asked confirm to replace the existing the publish from Dashboard, type in `yes`
9. After your domain is connected, open it in a browser, you should see `OK` indicating the Worker is deployed

## Patching Process
1. Upload your client files into the bucket inside a folder called `uo-files` (Using something like Cyberduck or RClone)
2. Upload your IPL Client **to the root of the bucket** as `MyShardLauncher.exe` (Replacing `MyShard` with your name from Step 6 in Setup)
3. Navigate to `/hashes`, after 60s or so it should update showing your new files/hashes

## Patch Client

### Configuration
1. Update the configuration/Rebuild your client
    - Set the `UpdateHost` to be your Cloudflare domain URL, e.g. `https://ipl.myshard.com`
    - Set the `UpdatePort` to be `80`

### Migration

You will need to distribute a new version of your client for users use the new IPL backend.

Two options:
1. Update your existing launcher to point to the new Cloudflare IPL, and use the existing patching server to distribute it (easiest)
2. Make an announcement, ask users to update manually (slowest)

