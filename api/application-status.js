import { db } from "hatchable";
export const access = "public";
export const methods = ["GET"];
export default async function(req,res){const id=req.query?.id;if(!id)return res.status(400).json({message:"Application ID आवश्यक है"});const {rows}=await db.query("SELECT id,name,product,agent_id,status,payment_status,created_at FROM applications WHERE id=$1",[id]);if(!rows.length)return res.status(404).json({message:"Application नहीं मिली"});res.json({success:true,application:rows[0]});}