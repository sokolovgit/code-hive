export const getAppName = () => {
  return process.env.npm_package_name || 'nestjs-app';
};

export const getAppVersion = () => {
  return process.env.npm_package_version || '';
};
