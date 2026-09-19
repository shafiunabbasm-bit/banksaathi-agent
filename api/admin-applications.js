import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){const {rows}=await db.query("SELECT id,name,phone,email,product,agent_id,status,payment_status,created_at FROM applications ORDER BY created_at DESC");res.json({success:true,applications:rows});}