import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const menuImages: Record<string, string> = {
  // 바다를본돼지 제주협재판포점
  '2163627c-95c7-42ec-9220-e575b8927121': 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=200',
  '379bda3c-9f52-44a5-a846-0e2239dca3a3': 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=200',
  '517cb81f-7f41-49f3-83f0-985205ac438d': 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=200',
  '6b91a63c-7674-4d1d-b9d3-0bda446ae84c': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=200',
  '09dd5154-7e38-4435-a535-e96f47bb2736': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=200',
  
  // 꺼멍연탄구이
  '8ebb3730-acc5-4abb-a8ef-dd338c9ba7cf': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=200',
  'f7640d8d-95eb-4e38-a5ba-17680794e65a': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=200',
  'a6a258e4-692f-4e09-a1a5-b7c7848d0b98': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=200',
  '21251e7c-54f2-4c43-bd4c-e3a35bcc7667': 'https://images.unsplash.com/photo-1580835239846-5bb9ce03c8c3?w=200',
  '41756845-1f1e-414a-a724-1e82e19820b8': 'https://images.unsplash.com/photo-1606850780554-b55ea4dd0b70?w=200',
  'd1c93223-5ad1-4bdc-9ab3-779f53d717df': 'https://images.unsplash.com/photo-1546554137-f86b9593a222?w=200',
  '6d6b606e-e355-4df8-ba1c-9740ca249272': 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=200',
  '480e2d27-3598-4342-aab1-e256f770267b': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200',
  '25057fab-6934-4e19-9de0-9b70265d2124': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200',
  
  // 바람수제비
  'ef7caec4-8a99-4559-b2f3-805033d8ed2d': 'https://images.unsplash.com/photo-1552874869-5c39ecbf93a8?w=200',
  '2e53d7bf-9852-4ba8-b83d-9940ebc0219d': 'https://images.unsplash.com/photo-1552874869-5c39ecbf93a8?w=200',
  'edf88e4d-b8a7-4100-a769-f91003fcc1ef': 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=200',
  
  // 엄블랑짬뽕
  '35b24fed-81e6-4b77-a81b-f418424a81f7': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200',
  'db52709b-a920-46d5-8384-2f158131a3cb': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200',
  'da61a898-74ba-46ee-8ec2-9a209004647b': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=200',
  'ea420b1a-a8b4-4dc0-92bd-6f77adb5a9f1': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200',
  
  // 한경가든
  '6b7c77e4-0188-4747-885d-105afdd1b8e0': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=200',
  '3cb79cd2-226b-4f20-822d-c1cc8a20e327': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=200',
  'dc2f1dc4-846b-4452-b0ae-d3a829568599': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=200',
  '69d365ac-58ea-448a-918a-7a4a5314c537': 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=200',
  
  // 마루나 키친
  'a5a52d85-724c-47c7-b791-80a186a5a1e9': 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=200',
  '39cc757a-5cad-4dcc-a5c8-d50d990e18e0': 'https://images.unsplash.com/photo-1556040220-4096d522378d?w=200',
  'b385af88-5c77-4708-b907-302520650e87': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=200',
  '265e0345-9fc0-42a5-a3ec-b45814f3f949': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200',
  
  // 신백정
  '231d9e79-f269-43b7-b3b5-f6d7134b7ef2': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=200',
  '33814f83-477f-48ce-b8b4-3f361187d34d': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=200',
  '12f8fefc-a7ac-4f1b-9b0a-89a7df6da5e4': 'https://images.unsplash.com/photo-1547514701-42782101795e?w=200',
  '93895d86-6b00-409e-8134-beb3ad0d8ae8': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=200',
  
  // 양가형제 본점
  '7c3b09ab-4c44-4b33-b535-cda70712b841': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200',
  'd4ba8734-32a3-46e1-a438-2a3ebc1f4d45': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200',
  '20109873-fba1-4615-9861-9b5baee60318': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200',
  '34c1375e-c23f-452b-854b-3fd3ddfcc49d': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200',
  '05e74db5-5d4b-447c-aa92-5e709794de7b': 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=200',
  
  // 뚱보아저씨
  '0e9b60b4-5446-4b62-b235-c6709e98920b': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=200',
  '6e356eaa-52f6-46bc-ba51-add246f9a5d7': 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=200',
  'cad2d513-61d9-4f9c-918c-c3934a60f72e': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200',
  
  // 중국집마씸
  '3cf09d47-8bfb-44bc-b42c-823f42b14f9a': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=200',
  '6fcdfd18-7ad7-4576-8e53-cfac35bebf4b': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=200',
  '260ad5fb-b0d6-460c-abb6-5ff66df6bc82': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200',
  '664f1404-c1dc-45c9-bd88-89fb2ef3e4b6': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200',
  '3ed7e441-0810-46bf-a9b3-446841974220': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200',
  'f1dbc0af-b3d9-4941-8df3-4ea87cc93f6c': 'https://images.unsplash.com/photo-1547514701-42782101795e?w=200',
  
  // DDC치킨 신창점
  'd00f9957-0413-42f9-8f71-452677f54be7': 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=200',
  '0f1cbb68-dc03-4edc-a4db-b18c985355c2': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=200',
  '81602113-2840-4e4c-a2c1-0aeb58220620': 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=200',
  'dbe194a1-22fe-4cab-8b4b-e52347f02ce4': 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=200',
  'e5026fdb-135c-4371-8df3-fd6dd3c8a31e': 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=200',
};

async function main() {
  let updatedCount = 0;
  
  for (const [menuId, imageUrl] of Object.entries(menuImages)) {
    const result = await prisma.menu.update({
      where: { id: menuId },
      data: { imageUrl },
    });
    console.log(`Updated: ${result.name} -> ${imageUrl}`);
    updatedCount++;
  }
  
  console.log(`\nTotal updated: ${updatedCount} menus`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
