import assert from 'node:assert/strict'
import { it } from 'node:test'
import { AsyncReadCache } from './async-read-cache.js'
it('deduplicates reads but invalidation prevents pre-write reads from returning stale cached status', async()=>{
  let now=0,calls=0
  const cache=new AsyncReadCache<string>(1500,()=>now)
  let finish!:(value:string)=>void
  const read=()=>{calls++;return new Promise<string>(resolve=>{finish=resolve})}
  const old=cache.get('repo',read), duplicate=cache.get('repo',read)
  assert.equal(old,duplicate);await Promise.resolve();assert.equal(calls,1)
  cache.invalidate('repo')
  assert.equal(await cache.get('repo',async()=>'conflicted'),'conflicted')
  finish('clean');assert.equal(await old,'clean')
  assert.equal(await cache.get('repo',async()=>'should-not-load'),'conflicted')
  now=1501;assert.equal(await cache.get('repo',async()=>'new-read'),'new-read')
  cache.invalidate('repo');await assert.rejects(cache.get('repo',async()=>{throw Error('failure')}))
  assert.equal(await cache.get('repo',async()=>'recovered'),'recovered')
})
