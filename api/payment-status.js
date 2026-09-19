import { db } from "hatchable";
export const access = "public";
export const methods = ["GET"];
export default async function(req,res){
 const q=new URL(req.url).searchParams,orderId=q.get("order_id"),appId=q.get("application_id");
 if(!orderId)return res.status(400).json({message:"order_id required"});
 const keyId=process.env.RAZORPAY_KEY_ID,secret=process.env.RAZORPAY_KEY_SECRET;
 if(!keyId||!secret)return res.status(503).json({configured:false,message:"Razorpay अभी configure नहीं है"});
 const rp=await fetch("https://api.razorpay.com/v1/orders/"+encodeURIComponent(orderId),{headers:{"Authorization":"Basic "+btoa(keyId+":"+secret)}});
 const data=await rp.json().catch(()=>({}));
 if(!rp.ok)return res.status(502).json({message:"Razorpay status check failed",details:data});
 const paid=data.status==="paid";
 if(appId)await db.query("UPDATE applications SET payment_status=$1,status=$2 WHERE id=$3 AND payment_order_id=$4",[paid?"Paid":"Unpaid",paid?"Payment Received":"Pending",appId,orderId]);
 res.json({configured:true,paid,order_status:data.status,order_id:orderId,application_id:appId});
}