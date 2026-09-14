/**
 * 用户友好的错误和警告信息
 * 
 * 设计原则：
 * 1. 清晰说明问题是什么
 * 2. 提供具体的解决方案
 * 3. 告知用户如果无法解决应该联系谁
 */

export const userFriendlyMessages = {
  // 网络和连接错误
  network: {
    offline: '网络连接已断开，请检查您的网络设置后重试。如果问题持续存在，请联系技术支持。',
    timeout: '请求超时，可能是网络不稳定。请稍后重试，或联系技术支持检查服务器状态。',
    serverError: '服务器暂时无法响应，请稍后再试。如果问题持续出现，请联系系统管理员。',
    unknown: '发生了未知错误，请刷新页面重试。如果问题依然存在，请联系技术支持并提供操作步骤。',
  },

  // 认证和权限错误
  auth: {
    notLoggedIn: '您还未登录，请先登录后再进行操作。',
    sessionExpired: '登录已过期，请重新登录以继续使用。',
    noPermission: '您没有权限执行此操作。如需权限，请联系系统管理员。',
    invalidCredentials: '用户名或密码错误，请检查后重试。如果忘记密码，请联系管理员重置。',
  },

  // 数据验证错误
  validation: {
    required: (field: string) => `请填写${field}，这是必填项。`,
    invalidFormat: (field: string) => `${field}格式不正确，请检查后重新输入。`,
    duplicate: (field: string) => `该${field}已存在，请使用其他${field}或联系管理员查询现有记录。`,
    tooLong: (field: string, max: number) => `${field}不能超过${max}个字符，请精简后重试。`,
    tooShort: (field: string, min: number) => `${field}至少需要${min}个字符，请补充完整。`,
    invalidPhone: '手机号格式不正确，请输入11位有效手机号。',
    invalidIdCard: '身份证号格式不正确，请检查后重新输入。',
  },

  // 操作错误
  operation: {
    createFailed: (item: string) => `创建${item}失败，请检查填写的信息是否完整正确。如果问题持续，请联系技术支持。`,
    updateFailed: (item: string) => `更新${item}失败，请稍后重试。如果问题持续，请联系技术支持。`,
    deleteFailed: (item: string) => `删除${item}失败，可能该${item}正在被使用。请先解除关联或联系管理员处理。`,
    loadFailed: (item: string) => `加载${item}失败，请刷新页面重试。如果问题持续，请联系技术支持。`,
    copyFailed: '复制失败，请手动选择文本复制，或尝试使用其他浏览器。',
    uploadFailed: '文件上传失败，请检查文件大小和格式是否符合要求。如需帮助，请联系技术支持。',
  },

  // 数据相关错误
  data: {
    notFound: (item: string) => `未找到该${item}，可能已被删除。请刷新页面查看最新数据。`,
    empty: (item: string) => `该${item}没有内容，请先添加内容后再试。`,
    alreadyExists: (item: string) => `该${item}已存在，请勿重复添加。如需修改，请使用编辑功能。`,
    cannotDelete: (item: string, reason: string) => `无法删除该${item}，因为${reason}。请先处理相关数据或联系管理员。`,
  },

  // 业务逻辑错误
  business: {
    activityFull: '该活动报名人数已满，无法继续添加参与人员。如需增加名额，请修改活动的需求人数。',
    participantExists: '该人员已参与此活动，请勿重复添加。如需修改参与信息，请使用编辑功能。',
    invalidDate: '日期设置不合理，结束日期不能早于开始日期。请重新选择日期。',
    cannotModifyPaid: '该记录已发薪，无法修改。如需调整，请联系财务人员或系统管理员。',
    noSelection: '请先选择要操作的项目，然后再执行操作。',
  },

  // 成功提示（作为对比参考）
  success: {
    created: (item: string) => `${item}创建成功！`,
    updated: (item: string) => `${item}更新成功！`,
    deleted: (item: string) => `${item}删除成功！`,
    copied: (item: string) => `${item}已复制到剪切板！`,
    uploaded: '文件上传成功！',
  },
};

/**
 * 格式化 API 错误信息为用户友好的提示
 */
export function formatApiError(error: any, context?: string): string {
  // 如果错误已经是用户友好的消息，直接返回
  if (error?.userMessage) {
    return error.userMessage;
  }

  // 网络错误
  if (!navigator.onLine) {
    return userFriendlyMessages.network.offline;
  }

  // 超时错误
  if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
    return userFriendlyMessages.network.timeout;
  }

  // 认证错误
  if (error?.status === 401 || error?.code === 'PGRST301') {
    return userFriendlyMessages.auth.sessionExpired;
  }

  // 权限错误
  if (error?.status === 403) {
    return userFriendlyMessages.auth.noPermission;
  }

  // 404 错误
  if (error?.status === 404) {
    return context 
      ? userFriendlyMessages.data.notFound(context)
      : '请求的资源不存在，请刷新页面后重试。';
  }

  // 服务器错误
  if (error?.status >= 500) {
    return userFriendlyMessages.network.serverError;
  }

  // 数据库约束错误
  if (error?.code === '23505') {
    return '该数据已存在，请勿重复添加。如需修改，请使用编辑功能。';
  }

  if (error?.code === '23503') {
    return '无法删除该数据，因为它正在被其他数据引用。请先删除相关数据或联系管理员。';
  }

  // 如果有具体的错误消息，尝试提取
  const errorMessage = error?.message || error?.error?.message || '';
  
  // 尝试从错误消息中提取有用信息
  if (errorMessage.includes('duplicate')) {
    return '该数据已存在，请勿重复添加。';
  }

  if (errorMessage.includes('foreign key')) {
    return '无法完成操作，因为存在关联数据。请先处理相关数据。';
  }

  // 默认错误消息
  return context
    ? `${context}失败，请稍后重试。如果问题持续，请联系技术支持。`
    : userFriendlyMessages.network.unknown;
}

/**
 * 创建带有解决方案的错误提示
 */
export function createErrorWithSolution(
  problem: string,
  solution: string,
  contact?: string
): string {
  let message = `${problem}\n\n💡 解决方法：${solution}`;
  
  if (contact) {
    message += `\n\n如需帮助，请联系${contact}。`;
  }
  
  return message;
}
