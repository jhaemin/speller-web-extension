export const manifest: chrome.runtime.ManifestV3 = {
  manifest_version: 3,
  name: '맞춤법 검사기',
  description: '텍스트를 선택하고 바로 맞춤법을 검사해보세요.',
  version: '1.0.0',
  content_scripts: [
    {
      js: ['speller.js'],
      matches: ['<all_urls>'],
      match_about_blank: true,
    },
  ],
}
