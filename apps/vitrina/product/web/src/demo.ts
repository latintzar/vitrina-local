/** Standalone, browser-local demonstration of the original API contract. */
const names = ['Tomato pasta', 'Roasted vegetable bowl', 'Lemon chickpeas', 'Mushroom toast'];
const products = [
  {id:'tomato',shop_id:'Garden Market',name:'Tomatoes',price_eur:2.4,unit:'pack'},
  {id:'pasta',shop_id:'Corner Pantry',name:'Pasta',price_eur:2.2,unit:'pack'},
  {id:'herbs',shop_id:'Garden Market',name:'Fresh herbs',price_eur:1.5,unit:'bunch'},
];
const groups = [
  {shop:{id:'Garden Market',name:'Garden Market',address:'Neighbourhood shop',walking_minutes:6},items:[{ingredient:'Tomatoes',quantity:'1 pack',product:products[0]},{ingredient:'Herbs',quantity:'1 bunch',product:products[2]}],subtotal_eur:3.9},
  {shop:{id:'Corner Pantry',name:'Corner Pantry',address:'Neighbourhood shop',walking_minutes:9},items:[{ingredient:'Pasta',quantity:'1 pack',product:products[1]}],subtotal_eur:2.2},
];
const videos = names.map((name,i)=>({id:`demo-${i}`,sort:i,source:'Web',source_id:`demo-${i}`,source_url:'',creator:'Vitrina demo',title:name,status:'processed',summary:'A simple meal with ingredients from nearby shops.',recipe_title:name,ingredient_preview:['Tomatoes','Pasta','Herbs'],media:{}}));
const key='vitrina-cook:demo-carts';
const read=()=>JSON.parse(localStorage.getItem(key)||'{}') as Record<string,any>;
const save=(data:unknown)=>localStorage.setItem(key,JSON.stringify(data));
const json=(data:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}));
export function installDemo() {
  localStorage.setItem('vitrina:welcomed','1');
  if (!localStorage.getItem('vitrina:location')) localStorage.setItem('vitrina:location',JSON.stringify({label:'Demo neighbourhood',lat:42.6977,lng:23.3219,precision:'approximate',source:'manual',capturedAt:new Date().toISOString()}));
  const original=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
    if (!url.pathname.startsWith('/api/')) return url.origin===location.origin ? original(input,init) : json({error:'Demo is local'},403);
    const path=url.pathname.slice(4), method=init?.method||'GET';
    if(path==='/recipe-videos') return json({videos,next_cursor:null,total:videos.length});
    if(path==='/recipe-videos/prematch/status') return json({total:4,resolved:4,skipped:0,failed:0,queued:0,running:0});
    if(path==='/recipe-videos/prematch') return json({});
    const recipe=path.match(/^\/recipe-videos\/(demo-\d+)$/);
    if(recipe){const v=videos.find(x=>x.id===recipe[1])||videos[0];return json({...v,recipe:{title:v.title,description:v.summary,ingredients:products.map(p=>({description:p.name})),directions:[],servings:{quantity:2}},stock_groups:groups,match:{feasibility:'full',shop_groups:groups,missing:[],blockers:[],total_eur:6.1,currency:'EUR'}});}
    if(path==='/carts'&&method==='POST'){const body=JSON.parse(String(init?.body||'{}'));const carts=read();const id=`demo-cart-${body.shop_id}`;carts[id]??={id,shop_id:body.shop_id,currency:'EUR',line_items:[]};save(carts);return json(carts[id]);}
    const match=path.match(/^\/carts\/([^/]+)(?:\/items(?:\/([^/]+))?)?$/);
    if(match){const carts=read(), cart=carts[match[1]];if(!cart)return json({},404);if(method==='POST'){const b=JSON.parse(String(init?.body||'{}'));const p=products.find(x=>x.id===b.product_id);if(p){const line=cart.line_items.find((x:any)=>x.product_id===p.id);if(line)line.quantity+=b.quantity;else cart.line_items.push({id:`line-${p.id}`,cart_id:cart.id,product_id:p.id,quantity:b.quantity,product_snapshot:p,group_id:b.group_id,group_metadata:b.group_metadata});}save(carts);}else if(method==='DELETE'&&match[2]){cart.line_items=cart.line_items.filter((x:any)=>x.id!==match[2]);save(carts);}else if(method==='PATCH'&&match[2]){const b=JSON.parse(String(init?.body||'{}'));const line=cart.line_items.find((x:any)=>x.id===match[2]);if(line)line.quantity=b.quantity;save(carts);}return json(cart);}
    return json({},404);
  };
}
