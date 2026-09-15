const assert = require('node:assert/strict');
(async () => {
 const {createBuiltinTheaterImageService} = await import('../modules/phone-theater/builtin/images.js');
 const records = new Map(); let sent;
 const settings = {imageGeneration:{enabled:true, theaterEnabled:{square:true}, promptTranslationEnabled:false}};
 const service=createBuiltinTheaterImageService({sceneId:'square',getPhoneSettings:()=>settings, ownershipStore:{read:async key=>records.get(key), write:async record=>records.set(record.key,record)}, imageGenerationRuntime:{
   composeCharacterImagePrompt: async ({description}) => ({prompt:'人物外貌，'+description}),
   generateAndStore: async input => {sent=input; return {ok:true,path:'/user/images/yuzi-phone-generated/example.png'};}
 }});
 const input={canvas:{canvas:'image',tableName:'sheet_square',stableIdentityFields:['帖子ID'],promptFields:['发帖账号名','图片描述'],promptSuffix:'画布宽高比为 2:1'}, chatScope:'chat:a', rowValues:{帖子ID:'1',发帖账号名:'阿青',图片描述:'海边',视频描述:'不许加入'}, candidateRows:[{帖子ID:'1'}],requestContext:{isStillCurrent:()=>true}};
 assert.equal((await service.generate(input)).ok,true);
 assert.equal(sent.prompt,'人物外貌，发帖账号名：阿青\n图片描述：海边\n画布宽高比为 2:1');
 assert.equal((await service.read(input)).imagePath,'/user/images/yuzi-phone-generated/example.png');
 settings.imageGeneration.theaterEnabled.square=false;
 assert.equal((await service.generate(input)).status,'disabled');
 assert.ok((await service.read(input)).imagePath, '关闭按钮不删除旧图');
 console.log('[theater-image-host] passed');
})().catch(error=>{console.error(error);process.exitCode=1});
