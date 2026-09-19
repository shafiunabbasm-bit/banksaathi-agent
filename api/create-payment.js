import { db } from "hatchable";
export const access = "public";
export const methods = ["POST"];
export default async function(req,res){
  const b=req.body||{}, id=String(b.application_id||""), amount=Number(b.amount||0);
  if(!id||!Number.isFinite(amount)||amount<1)return res.status(400).json({message:"application_id और valid amount (कम से कम ₹1) जरूरी है"});
  const q=await db.query("SELECT id,name,phone,email FROM applications WHERE id=$1 LIMIT 1",[id]);
  if(!q.rows?.length)return res.status(404).json({message:"Application नहीं मिली"});
  const app=q.rows[0], keyId=process.env.RAZORPAY_KEY_ID, secret=process.env.RAZORPAY_KEY_SECRET;
  if(!keyId||!secret)return res.status(503).json({configured:false,message:"Razorpay credentials अभी configure नहीं हैं"});
  const receipt="BS_"+String(app.id).replaceAll("-","").slice(0,24)+"_"+Date.now();
  const rp=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Basic "+btoa(keyId+":"+secret)},body:JSON.stringify({amount:Math.round(amount*100),currency:"INR",receipt,notes:{application_id:String(id)}})});
  const data=await rp.json().catch(()=>({}));
  if(!rp.ok)return res.status(502).json({message:"Razorpay order create failed",details:data});
  await db.query("UPDATE applications SET amount=$1,currency='INR',payment_order_id=$2,payment_status='Unpaid',status='Pending' WHERE id=$3",[amount,data.id,id]);
  res.json({configured:true,key_id:keyId,application_id:id,order_id:data.id,amount:Math.round(amount*100),display_amount:amount,currency:"INR",name:app.name,email:app.email||"",phone:app.phone||""});
}