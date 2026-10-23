export type WidevineAdvancedConfig = Record<
  'com.widevine.alpha',
  {
    videoRobustness: string[];
    audioRobustness: string[];
  }
>;

export function buildWidevineAdvancedConfig(options: {
  widevineRobustness: string | null;
  organizationId: string | null;
  collectionId: string | null;
}): WidevineAdvancedConfig {
  const advancedConfig: WidevineAdvancedConfig = {
    'com.widevine.alpha': {
      videoRobustness: ['SW_SECURE_CRYPTO'],
      audioRobustness: ['SW_SECURE_CRYPTO'],
    },
  };

  const r = options.widevineRobustness?.toLowerCase();
  if (r === 'l1') {
    advancedConfig['com.widevine.alpha'].videoRobustness = ['HW_SECURE_ALL'];
    advancedConfig['com.widevine.alpha'].audioRobustness = ['SW_SECURE_CRYPTO'];
  } else if (r === 'l2') {
    advancedConfig['com.widevine.alpha'].videoRobustness = ['HW_SECURE_CRYPTO'];
    advancedConfig['com.widevine.alpha'].audioRobustness = ['SW_SECURE_CRYPTO'];
  } else if (r === 'custom') {
    advancedConfig['com.widevine.alpha'].videoRobustness = ['SW_SECURE_CRYPTO'];
    advancedConfig['com.widevine.alpha'].audioRobustness = ['SW_SECURE_CRYPTO'];
  } else {
    advancedConfig['com.widevine.alpha'].videoRobustness = [
      'HW_SECURE_ALL',
      'SW_SECURE_DECODE',
      'SW_SECURE_CRYPTO',
    ];
    advancedConfig['com.widevine.alpha'].audioRobustness = ['SW_SECURE_CRYPTO'];
  }

  const orgId = options.organizationId;
  const collId = options.collectionId;
  if (
    (orgId &&
      (orgId === '689e45cbc50191d6b1132597' ||
        orgId === '68b6fa38c8fedf0d357af63e')) ||
    (collId && collId === '691d2a4515bb3da862a6a579')
  ) {
    advancedConfig['com.widevine.alpha'].videoRobustness = [
      'HW_SECURE_ALL',
      'SW_SECURE_CRYPTO',
    ];
    advancedConfig['com.widevine.alpha'].audioRobustness = ['SW_SECURE_CRYPTO'];
  }

  return advancedConfig;
}
