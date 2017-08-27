module.exports = function(context) {
  const fs = context.requireCordovaModule('fs');
  const et = context.requireCordovaModule('elementtree');
  const subElement = et.SubElement;

  const buildPlatform = 'ios';

  let cauConfig;
  try {
    cauConfig = require(process.cwd() + '/cau.config.json');
  } catch (err) {
    return;
  }

  if (!cauConfig.server) {
    console.log('Air Update server or codeSignSecret is not set.');
    return;
  }



  let contents = fs.readFileSync('./config.xml', 'utf-8');
  if(contents) {
    //Windows is the BOM. Skip the Byte Order Mark.
    contents = contents.substring(contents.indexOf('<'));
  }

  const elm = new et.ElementTree(et.XML(contents));

  const widget = elm._root;

  let serverElm = elm.findall('air-update-server')[0];
  if (!serverElm) {
    serverElm = subElement(widget, 'air-update-server');
  }
  serverElm.set('value', cauConfig.server);
  // serverElm.set('signSecret', cauConfig.codeSignSecret);


  const platformElm = elm.findall('platform/[@name="' + buildPlatform + '"]')[0];


  const channelsElms = elm.findall('platform/[@name="' + buildPlatform + '"]/air-update-channel');

  const channels = cauConfig.platforms[buildPlatform];
  const channelKeys = Object.keys(channels);

  channelKeys.forEach((channelKey) => {
    let channelElmIndex = channelsElms.findIndex(chElm => chElm.get('code') === channelKey);
    let channelElm;
    if (channelElmIndex === -1) {
      channelElm = subElement(platformElm, 'air-update-channel');
    }else {
      channelElm = channelsElms[channelElmIndex];
      channelsElms.splice(channelElmIndex, 1);
    }

    const channel = channels[channelKey];

    channelElm.set('code', channelKey);
    channelElm.set('name', channel.name);
    channelElm.set('def', channel.def);
    channelElm.set('value', channel.id);

  });

  if (channelsElms.length) {
    const children = platformElm.getchildren();
    channelsElms.forEach((channelElm) => {
      const code = channelElm.get('code');
      const index = children.findIndex((child) => child.get('code') === code);
      if (index > -1) {
        children.splice(index, 1);
      }
    });
  }

  const xml = elm.write({'xml_declaration': true});
  fs.writeFileSync('./config.xml', xml);

};
