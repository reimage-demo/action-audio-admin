import {convexTest} from 'convex-test';
import {beforeEach,describe,expect,it} from 'vitest';
import schema from '../convex/schema';
import {api} from '../convex/_generated/api';
const modules=import.meta.glob('../convex/**/*.ts');
const request=(extra={})=>({name:'Estimate Customer',phone:'8605550123',vehicleMake:'Toyota',vehicleModel:'2022 Camry',service:'remote-starters',requestKey:crypto.randomUUID(),...extra});
beforeEach(()=>{process.env.CUSTOMER_ENCRYPTION_KEY_ID='test-v1';process.env.CUSTOMER_ENCRYPTION_KEYS=JSON.stringify({'test-v1':'12'.repeat(32)});process.env.CUSTOMER_INDEX_KEY='34'.repeat(32);});
async function staff(t:ReturnType<typeof convexTest>){const id=await t.run(ctx=>ctx.db.insert('users',{name:'Manager'}));await t.run(ctx=>ctx.db.insert('authAccounts',{userId:id,provider:'password',providerAccountId:'actionaudiomanager'}));return t.withIdentity({subject:id+'|session'});}
describe('encrypted service estimates',()=>{
 it('routes the selected service, stores only ciphertext and deduplicates retries',async()=>{
  const t=convexTest(schema,modules),admin=await staff(t),args=request();
  expect(await t.mutation(api.estimates.create,args)).toEqual({received:true});
  await t.mutation(api.estimates.create,args);
  const rows=await t.run(ctx=>ctx.db.query('estimates').collect());expect(rows).toHaveLength(1);
  const raw=JSON.stringify(rows);for(const value of [args.name,args.phone,args.vehicleMake,args.vehicleModel,args.service,args.requestKey])expect(raw).not.toContain(value);
  const saved=(await admin.query(api.estimates.list,{}))[0];expect(saved).toMatchObject({name:args.name,service:'remote-starters',store:'wethersfield',status:'new'});
  await t.mutation(api.estimates.create,request({service:'auto-detailing',phone:'8605550145'}));
  expect((await admin.query(api.estimates.list,{})).find(a=>a.service==='auto-detailing')?.store).toBe('hartford');
  await expect(t.mutation(api.estimates.create,{...args,vehicleMake:'Honda'})).rejects.toThrow('already submitted');
 });
 it('limits access and persists internal staff updates only for authorized staff',async()=>{
  const t=convexTest(schema,modules),admin=await staff(t);await t.mutation(api.estimates.create,request());
  await expect(t.query(api.estimates.list,{})).rejects.toThrow('Staff access');
  const a=(await admin.query(api.estimates.list,{}))[0];
  await expect(t.mutation(api.estimates.update,{id:a._id,status:'quoted',staffNotes:'Quote discussed'})).rejects.toThrow('Staff access');
  await admin.mutation(api.estimates.update,{id:a._id,status:'quoted',staffNotes:'Approximate price discussed by phone.'});
  const saved=(await admin.query(api.estimates.list,{}))[0];expect(saved.status).toBe('quoted');expect(saved.staffNotes).toContain('price discussed');
  const raw=JSON.stringify(await t.run(ctx=>ctx.db.query('estimates').collect()));expect(raw).not.toContain('price discussed');
 });
 it('validates contact, vehicle and service details and rejects automated spam',async()=>{
  const t=convexTest(schema,modules);
  for(const extra of [{name:'x'},{phone:'123'},{vehicleMake:''},{vehicleModel:''},{service:'not-a-service'}])await expect(t.mutation(api.estimates.create,request(extra))).rejects.toThrow('Check your');
  await expect(t.mutation(api.estimates.create,request({website:'spam'}))).rejects.toThrow('Unable');
  for(let i=0;i<3;i++)await t.mutation(api.estimates.create,request());
  await expect(t.mutation(api.estimates.create,request({phone:'(860) 555-0123'}))).rejects.toThrow('additional estimates');
 });
});
