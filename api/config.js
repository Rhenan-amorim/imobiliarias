export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).end();
 return res.status(200).json({authUrl:process.env.NEON_AUTH_BASE_URL});
}
