import { supabase } from './supabase';
import type { Activity, Person, ActivityParticipant, ActivityFormData, PersonFormData, Statistics, Leader, LeaderFormData, ParticipantFormData, ActivityType, ActivityTypeFormData, LeaderRecruitmentStats, LeaderParticipant, ActivityLeaderChange, PromotionTask, PromotionTaskFormData, PromotionTaskRecord, PromotionTaskDetail, PromotionTaskDetailFormData } from '@/types';

// 获取当前用户ID
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return user.id;
}

// ============ 活动相关API ============

// 获取所有活动
export async function getActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities_with_details')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return Array.isArray(data) ? data.map((item: any) => ({
    ...item,
    participant_count: item.participant_count || 0,
    activity_type_name: item.activity_type_name
  })) : [];
}

// 获取单个活动详情
export async function getActivity(id: string): Promise<Activity | null> {
  const { data, error } = await supabase
    .from('activities_with_details')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  
  if (data) {
    return {
      ...data,
      participant_count: (data as any).participant_count || 0,
      activity_type_name: (data as any).activity_type_name
    };
  }
  
  return null;
}

// 创建活动
export async function createActivity(activity: ActivityFormData): Promise<Activity> {
  const userId = await getCurrentUserId();
  
  // 检查活动名称是否已存在
  const { data: existing, error: checkError } = await supabase
    .from('activities')
    .select('id, name')
    .eq('name', activity.name)
    .maybeSingle();
  
  if (checkError) throw checkError;
  
  if (existing) {
    throw new Error(`活动名称"${activity.name}"已存在，请使用其他名称`);
  }
  
  // 处理空字符串字段，将其转换为 null
  const cleanedActivity = {
    ...activity,
    start_date: activity.start_date || null,
    end_date: activity.end_date || null,
    payment_date: activity.payment_date || null,
    user_id: userId
  };
  
  const { data, error } = await supabase
    .from('activities')
    .insert([cleanedActivity])
    .select()
    .single();

  if (error) {
    // 处理数据库唯一约束错误
    if (error.code === '23505' && error.message.includes('activities_name_unique')) {
      throw new Error(`活动名称"${activity.name}"已存在，请使用其他名称`);
    }
    throw error;
  }
  return data;
}

// 更新活动
export async function updateActivity(id: string, activity: Partial<ActivityFormData>): Promise<Activity> {
  // 如果更新了名称，检查是否与其他活动重名
  if (activity.name) {
    const { data: existing, error: checkError } = await supabase
      .from('activities')
      .select('id, name')
      .eq('name', activity.name)
      .neq('id', id)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    if (existing) {
      throw new Error(`活动名称"${activity.name}"已存在，请使用其他名称`);
    }
  }
  
  // 处理空字符串字段，将其转换为 null
  const cleanedActivity = { ...activity };
  if ('start_date' in cleanedActivity && !cleanedActivity.start_date) {
    cleanedActivity.start_date = null;
  }
  if ('end_date' in cleanedActivity && !cleanedActivity.end_date) {
    cleanedActivity.end_date = null;
  }
  if ('payment_date' in cleanedActivity && !cleanedActivity.payment_date) {
    cleanedActivity.payment_date = null;
  }
  
  const { data, error } = await supabase
    .from('activities')
    .update(cleanedActivity)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // 处理数据库唯一约束错误
    if (error.code === '23505' && error.message.includes('activities_name_unique')) {
      throw new Error(`活动名称"${activity.name}"已存在，请使用其他名称`);
    }
    throw error;
  }
  return data;
}

// 删除活动
export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 批量删除活动
export async function deleteActivities(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .delete()
    .in('id', ids);

  if (error) throw error;
}

// 批量创建活动
export async function createActivities(activities: ActivityFormData[]): Promise<Activity[]> {
  const userId = await getCurrentUserId();
  // 处理空字符串字段，将其转换为 null
  const activitiesWithUser = activities.map(activity => ({
    ...activity,
    start_date: activity.start_date || null,
    end_date: activity.end_date || null,
    payment_date: activity.payment_date || null,
    user_id: userId
  }));
  const { data, error } = await supabase
    .from('activities')
    .insert(activitiesWithUser)
    .select();

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 批量更新活动(更新指定字段)
export async function updateActivities(ids: string[], updates: Partial<ActivityFormData>): Promise<void> {
  // 处理空字符串字段，将其转换为 null
  const cleanedUpdates = { ...updates };
  if ('start_date' in cleanedUpdates && !cleanedUpdates.start_date) {
    cleanedUpdates.start_date = null;
  }
  if ('end_date' in cleanedUpdates && !cleanedUpdates.end_date) {
    cleanedUpdates.end_date = null;
  }
  if ('payment_date' in cleanedUpdates && !cleanedUpdates.payment_date) {
    cleanedUpdates.payment_date = null;
  }
  
  const { error } = await supabase
    .from('activities')
    .update(cleanedUpdates)
    .in('id', ids);

  if (error) throw error;
}

// ============ 人员相关API ============

// 获取所有人员
export async function getPersons(): Promise<Person[]> {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取单个人员详情
export async function getPerson(id: string): Promise<Person | null> {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 创建人员
export async function createPerson(person: PersonFormData): Promise<Person> {
  const userId = await getCurrentUserId();
  
  // 检查姓名和电话组合是否已存在（只在电话非空时检查）
  if (person.contact && person.contact.trim() !== '') {
    const { data: existing, error: checkError } = await supabase
      .from('persons')
      .select('id, name, contact')
      .eq('name', person.name)
      .eq('contact', person.contact)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    if (existing) {
      throw new Error(`人员"${person.name}"（电话：${person.contact}）已存在`);
    }
  }
  
  const { data, error } = await supabase
    .from('persons')
    .insert([{ ...person, user_id: userId }])
    .select()
    .single();

  if (error) {
    // 处理数据库唯一约束错误
    if (error.code === '23505' && error.message.includes('persons_name_contact_unique')) {
      throw new Error(`人员"${person.name}"（电话：${person.contact}）已存在`);
    }
    throw error;
  }
  return data;
}

// 根据联系方式查找人员
export async function getPersonByContact(contact: string): Promise<Person | null> {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq('contact', contact)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 批量创建人员
export async function createPersons(persons: PersonFormData[]): Promise<Person[]> {
  const userId = await getCurrentUserId();
  const personsWithUser = persons.map(person => ({ ...person, user_id: userId }));
  const { data, error } = await supabase
    .from('persons')
    .insert(personsWithUser)
    .select();

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 更新人员
export async function updatePerson(id: string, person: Partial<PersonFormData>): Promise<Person> {
  // 如果更新了姓名或电话，需要检查唯一性
  if (person.name !== undefined || person.contact !== undefined) {
    // 先获取当前人员信息
    const { data: current } = await supabase
      .from('persons')
      .select('name, contact')
      .eq('id', id)
      .maybeSingle();
    
    // 合并新旧值，得到最终的姓名和电话
    const finalName = person.name !== undefined ? person.name : current?.name;
    const finalContact = person.contact !== undefined ? person.contact : current?.contact;
    
    // 只有当最终的电话非空时，才检查唯一性（与数据库约束保持一致）
    if (finalName && finalContact && finalContact.trim() !== '') {
      const { data: existing, error: checkError } = await supabase
        .from('persons')
        .select('id, name, contact')
        .eq('name', finalName)
        .eq('contact', finalContact)
        .neq('id', id)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existing) {
        throw new Error(`人员"${finalName}"（电话：${finalContact}）已存在`);
      }
    }
  }
  
  const { data, error } = await supabase
    .from('persons')
    .update(person)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // 处理数据库唯一约束错误
    if (error.code === '23505' && error.message.includes('persons_name_contact_unique')) {
      throw new Error(`人员"${person.name}"（电话：${person.contact}）已存在`);
    }
    throw error;
  }
  return data;
}

// 删除人员
export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase
    .from('persons')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 批量删除人员
export async function deletePersons(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('persons')
    .delete()
    .in('id', ids);

  if (error) throw error;
}

// 批量更新人员(更新指定字段)
export async function updatePersons(ids: string[], updates: Partial<PersonFormData>): Promise<void> {
  const { error } = await supabase
    .from('persons')
    .update(updates)
    .in('id', ids);

  if (error) throw error;
}

// ============ 活动参与关系API ============

// 获取活动的参与人员
export async function getActivityParticipants(activityId: string): Promise<Person[]> {
  const { data: participants, error: pError } = await supabase
    .from('activity_participants')
    .select('person_id')
    .eq('activity_id', activityId);

  if (pError) throw pError;
  if (!participants || participants.length === 0) return [];

  const personIds = participants.map(p => p.person_id).filter(Boolean);
  const { data: persons, error: sError } = await supabase
    .from('persons')
    .select('*')
    .in('id', personIds);

  if (sError) throw sError;
  return Array.isArray(persons) ? persons : [];
}

// 获取人员参与的活动
export async function getPersonActivities(personId: string): Promise<Activity[]> {
  const { data: participants, error: pError } = await supabase
    .from('activity_participants')
    .select('activity_id')
    .eq('person_id', personId);

  if (pError) throw pError;
  if (!participants || participants.length === 0) return [];

  const activityIds = participants.map(p => p.activity_id).filter(Boolean);
  const { data: activities, error: sError } = await supabase
    .from('activities')
    .select('*')
    .in('id', activityIds);

  if (sError) throw sError;
  return Array.isArray(activities) ? activities : [];
}

// 添加活动参与人员
export async function addActivityParticipant(activityId: string, personId: string): Promise<ActivityParticipant> {
  const { data, error } = await supabase
    .from('activity_participants')
    .insert([{ activity_id: activityId, person_id: personId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 批量添加活动参与人员(带默认值)
export async function addActivityParticipants(activityId: string, personIds: string[], source: string = 'manual'): Promise<void> {
  // 获取活动信息以获取默认值
  const activity = await getActivity(activityId);
  if (!activity) throw new Error('活动不存在');

  // 添加新关系(不删除现有关系,只添加新的)
  if (personIds.length > 0) {
    // 获取要添加的人员信息（包含电话号码）
    const { data: personsToAdd, error: personsError } = await supabase
      .from('persons')
      .select('id, contact')
      .in('id', personIds);

    if (personsError) throw personsError;
    if (!personsToAdd || personsToAdd.length === 0) throw new Error('人员不存在');

    // 获取该活动已有的参与人员
    const { data: existingParticipants, error: existingError } = await supabase
      .from('activity_participants')
      .select('person_id')
      .eq('activity_id', activityId);

    if (existingError) throw existingError;

    // 分步查询以避免外键依赖
    const existingPersonIds = (existingParticipants || []).map(p => p.person_id);
    const { data: existingPersons, error: personsDataError } = await supabase
      .from('persons')
      .select('contact')
      .in('id', existingPersonIds);

    if (personsDataError) throw personsDataError;

    // 提取已存在的电话号码
    const existingContacts = new Set(
      (existingPersons || []).map(p => p.contact).filter(Boolean)
    );

    // 检查是否有重复的电话号码
    const duplicateContacts: string[] = [];
    personsToAdd.forEach(person => {
      if (person.contact && existingContacts.has(person.contact)) {
        duplicateContacts.push(person.contact);
      }
    });

    if (duplicateContacts.length > 0) {
      throw new Error(`以下电话号码已报名此活动：${duplicateContacts.join('、')}，无需重复报名`);
    }

    const participants = personIds.map(personId => ({
      activity_id: activityId,
      person_id: personId,
      status: '已确认',
      salary: activity.part_time_salary || null,
      deposit: activity.deposit || 0,
      per_head_fee: activity.per_head_fee || null,
      registration_source: source,
      is_viewed: source === 'manual', // 手动添加的直接标记为已查看，二维码报名的标记为未查看
    }));

    const { error } = await supabase
      .from('activity_participants')
      .insert(participants);

    if (error) throw error;
  }
}

// 批量添加参与人员(带详细信息)
export async function addParticipantsToActivity(
  activityId: string,
  participants: Array<{ personId: string; details?: Partial<ParticipantFormData> }>
): Promise<void> {
  const records = participants.map(p => ({
    activity_id: activityId,
    person_id: p.personId,
    status: p.details?.status || '待确认',
    salary: p.details?.salary,
    deposit: p.details?.deposit,
    per_head_fee: p.details?.per_head_fee,
    introducer_id: p.details?.introducer_id,
    is_paid: p.details?.is_paid || false,
  }));

  const { error } = await supabase
    .from('activity_participants')
    .insert(records);

  if (error) throw error;
}


// 一键发薪完毕 (将活动下所有参与人员状态改为已发薪)
export async function markAllParticipantsAsPaid(activityId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_participants')
    .update({ is_paid: true })
    .eq('activity_id', activityId);

  if (error) throw error;
}

// 移除活动参与人员
export async function removeActivityParticipant(activityId: string, personId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_participants')
    .delete()
    .eq('activity_id', activityId)
    .eq('person_id', personId);

  if (error) throw error;
}

// ============ 统计数据API ============

// 获取统计数据
export async function getStatistics(): Promise<Statistics> {
  // 获取今天的日期范围
  const today = new Date().toISOString().split('T')[0];
  const todayStart = `${today}T00:00:00`;
  const todayEnd = `${today}T23:59:59`;

  // 获取活动总数
  const { count: totalActivities } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true });

  // 获取人员总数
  const { count: totalPersons } = await supabase
    .from('persons')
    .select('*', { count: 'exact', head: true });

  // 获取领队总数
  const { count: totalLeaders } = await supabase
    .from('leaders')
    .select('*', { count: 'exact', head: true });

  // 获取正在进行的活动数量(开始日期<=今天且结束日期>=今天,或开始日期<=今天且无结束日期)
  const { count: ongoingActivities } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .lte('start_date', today)
    .or(`end_date.gte.${today},end_date.is.null`)
    .in('status', ['已确认', '进行中']);

  // 获取即将进行的活动数量(开始日期>今天)
  const { count: upcomingActivities } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .gt('start_date', today)
    .in('status', ['待确认', '已确认']);

  // 获取待发薪人数(is_paid=false)
  const { count: unpaidParticipants } = await supabase
    .from('activity_participants')
    .select('*', { count: 'exact', head: true })
    .eq('is_paid', false);

  // 获取即将结束的活动数量 (结束日期在未来3天内)
  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const threeDaysLaterStr = threeDaysLater.toISOString().split('T')[0];

  const { count: endingSoonActivities } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .gte('end_date', today)
    .lte('end_date', threeDaysLaterStr)
    .not('status', 'eq', '已取消')
    .not('status', 'eq', '已完成');

  // 获取今日新增活动数量
  const { count: todayNewActivities } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart)
    .lte('created_at', todayEnd);

  // 获取今日新增人员数量
  const { count: todayNewPersons } = await supabase
    .from('persons')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart)
    .lte('created_at', todayEnd);

  // 获取今日新增领队数量
  const { count: todayNewLeaders } = await supabase
    .from('leaders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart)
    .lte('created_at', todayEnd);

  // 获取今日新增参与记录数量
  const { count: todayNewParticipants } = await supabase
    .from('activity_participants')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart)
    .lte('created_at', todayEnd);

  return {
    total_activities: totalActivities || 0,
    total_persons: totalPersons || 0,
    total_leaders: totalLeaders || 0,
    ongoing_activities: ongoingActivities || 0,
    upcoming_activities: upcomingActivities || 0,
    unpaid_participants: unpaidParticipants || 0,
    ending_soon_activities: endingSoonActivities || 0,
    today_new_activities: todayNewActivities || 0,
    today_new_persons: todayNewPersons || 0,
    today_new_leaders: todayNewLeaders || 0,
    today_new_participants: todayNewParticipants || 0,
  };
}

// ============ 图片上传API ============

// 上传人员照片
export async function uploadPersonPhoto(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('app-99gqsi7u251d_person_images')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('app-99gqsi7u251d_person_images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// 删除人员照片
export async function deletePersonPhoto(photoUrl: string): Promise<void> {
  const fileName = photoUrl.split('/').pop();
  if (!fileName) return;

  const { error } = await supabase.storage
    .from('app-99gqsi7u251d_person_images')
    .remove([fileName]);

  if (error) throw error;
}

// ============ 领队相关API ============

// 获取所有领队
export async function getLeaders(): Promise<Leader[]> {
  const { data, error } = await supabase
    .from('leaders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取单个领队详情
export async function getLeader(id: string): Promise<Leader | null> {
  const { data, error } = await supabase
    .from('leaders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 创建领队
export async function createLeader(leader: LeaderFormData): Promise<Leader> {
  const userId = await getCurrentUserId();
  
  // 检查姓名和联系方式组合是否已存在（只在联系方式非空时检查）
  if (leader.contact && leader.contact.trim() !== '') {
    const { data: existing, error: checkError } = await supabase
      .from('leaders')
      .select('id, name, contact')
      .eq('name', leader.name)
      .eq('contact', leader.contact)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    if (existing) {
      throw new Error(`领队"${leader.name}"（联系方式：${leader.contact}）已存在`);
    }
  }
  
  const { data, error } = await supabase
    .from('leaders')
    .insert([{ ...leader, user_id: userId }])
    .select()
    .single();

  if (error) {
    // 处理数据库唯一约束错误
    if (error.code === '23505' && error.message.includes('leaders_name_contact_unique')) {
      throw new Error(`领队"${leader.name}"（联系方式：${leader.contact}）已存在`);
    }
    throw error;
  }
  return data;
}

// 更新领队
export async function updateLeader(id: string, leader: Partial<LeaderFormData>): Promise<Leader> {
  // 如果更新了姓名或联系方式，需要检查唯一性
  if (leader.name !== undefined || leader.contact !== undefined) {
    // 先获取当前领队信息
    const { data: current } = await supabase
      .from('leaders')
      .select('name, contact')
      .eq('id', id)
      .maybeSingle();
    
    // 合并新旧值，得到最终的姓名和联系方式
    const finalName = leader.name !== undefined ? leader.name : current?.name;
    const finalContact = leader.contact !== undefined ? leader.contact : current?.contact;
    
    // 只有当最终的联系方式非空时，才检查唯一性（与数据库约束保持一致）
    if (finalName && finalContact && finalContact.trim() !== '') {
      const { data: existing, error: checkError } = await supabase
        .from('leaders')
        .select('id, name, contact')
        .eq('name', finalName)
        .eq('contact', finalContact)
        .neq('id', id)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existing) {
        throw new Error(`领队"${finalName}"（联系方式：${finalContact}）已存在`);
      }
    }
  }
  
  const { data, error } = await supabase
    .from('leaders')
    .update(leader)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // 处理数据库唯一约束错误
    if (error.code === '23505' && error.message.includes('leaders_name_contact_unique')) {
      throw new Error(`领队"${leader.name}"（联系方式：${leader.contact}）已存在`);
    }
    throw error;
  }
  return data;
}

// 删除领队
export async function deleteLeader(id: string): Promise<void> {
  const { error } = await supabase
    .from('leaders')
    .delete()
    .eq('id', id);

  if (error) throw error;
}


// ============ 备份相关API ============

// 获取当前登录用户信息
export async function getSessionUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 获取全量备份数据
export async function getFullBackupData() {
  const [activities, persons, leaders, participantsResult] = await Promise.all([
    getActivities(),
    getPersons(),
    getLeaders(),
    supabase.from('activity_participants').select('*, activities(name), persons(name, contact)')
  ]);

  if (participantsResult.error) throw participantsResult.error;

  return {
    activities,
    persons,
    leaders,
    participants: participantsResult.data || []
  };
}

// 批量删除领队
export async function deleteLeaders(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('leaders')
    .delete()
    .in('id', ids);

  if (error) throw error;
}

// 批量创建领队
export async function createLeaders(leaders: LeaderFormData[]): Promise<Leader[]> {
  const userId = await getCurrentUserId();
  const leadersWithUser = leaders.map(leader => ({ ...leader, user_id: userId }));
  const { data, error } = await supabase
    .from('leaders')
    .insert(leadersWithUser)
    .select();

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 批量更新领队
export async function updateLeaders(ids: string[], updates: Partial<LeaderFormData>): Promise<void> {
  const { error } = await supabase
    .from('leaders')
    .update(updates)
    .in('id', ids);

  if (error) throw error;
}

// ============ 活动领队关系API ============

// 获取活动的领队列表
export async function getActivityLeaders(activityId: string): Promise<Leader[]> {
  const { data: relations, error: rError } = await supabase
    .from('activity_leaders')
    .select('leader_id')
    .eq('activity_id', activityId);

  if (rError) throw rError;
  if (!relations || relations.length === 0) return [];

  const leaderIds = relations.map(r => r.leader_id).filter(Boolean);
  const { data: leaders, error: lError } = await supabase
    .from('leaders')
    .select('*')
    .in('id', leaderIds);

  if (lError) throw lError;
  return Array.isArray(leaders) ? leaders : [];
}

// 为活动添加领队
export async function addLeaderToActivity(activityId: string, leaderId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_leaders')
    .insert([{ activity_id: activityId, leader_id: leaderId }]);

  if (error) throw error;
}

// 从活动移除领队
export async function removeLeaderFromActivity(activityId: string, leaderId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_leaders')
    .delete()
    .eq('activity_id', activityId)
    .eq('leader_id', leaderId);

  if (error) throw error;
}

// 批量设置活动领队
export async function setActivityLeaders(activityId: string, leaderIds: string[]): Promise<void> {
  // 先删除现有关系
  await supabase
    .from('activity_leaders')
    .delete()
    .eq('activity_id', activityId);

  // 添加新关系
  if (leaderIds.length > 0) {
    const relations = leaderIds.map(leaderId => ({
      activity_id: activityId,
      leader_id: leaderId,
      participant_count: 0, // 初始人数为0
    }));

    const { error } = await supabase
      .from('activity_leaders')
      .insert(relations);

    if (error) throw error;
  }
}

// ============ 活动领队人数管理API ============

// 更新领队人数（增量方式）
export async function updateActivityLeaderCount(
  activityLeaderId: string,
  changeAmount: number,
  note?: string
): Promise<{
  success: boolean;
  change_id: string;
  previous_count: number;
  new_count: number;
  change_amount: number;
}> {
  const { data, error } = await supabase.rpc('update_activity_leader_count', {
    p_activity_leader_id: activityLeaderId,
    p_change_amount: changeAmount,
    p_note: note || null,
  });

  if (error) throw error;
  return data;
}

// 获取活动领队的变更记录
export async function getActivityLeaderChanges(activityId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('activity_leader_changes')
    .select(`
      *,
      leader:leaders(id, name, contact)
    `)
    .eq('activity_id', activityId)
    .order('changed_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取单个领队的变更记录
export async function getLeaderChanges(activityLeaderId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('activity_leader_changes')
    .select('*')
    .eq('activity_leader_id', activityLeaderId)
    .order('changed_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取活动的领队及其人数信息
export async function getActivityLeadersWithCount(activityId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('activity_leaders')
    .select(`
      *,
      leader:leaders(id, name, contact, gender, wechat, notes)
    `)
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ============ 活动参与人员增强API ============

// 更新参与人员详细信息
export async function updateParticipantDetails(
  activityId: string,
  personId: string,
  details: Partial<ParticipantFormData>
): Promise<void> {
  const { error } = await supabase
    .from('activity_participants')
    .update(details)
    .eq('activity_id', activityId)
    .eq('person_id', personId);

  if (error) throw error;
}

// 批量更新参与记录状态
export async function batchUpdateParticipantStatus(
  participantIds: string[],
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('activity_participants')
    .update({ status })
    .in('id', participantIds);

  if (error) throw error;
}

// 单独更新参与人员的添加时间
export async function updateParticipantAddedAt(
  participantId: string,
  addedAt: string
): Promise<void> {
  const { error } = await supabase
    .from('activity_participants')
    .update({ added_at: addedAt })
    .eq('id', participantId);

  if (error) throw error;
}

// 获取活动参与人员详细信息
export async function getActivityParticipantsWithDetails(activityId: string): Promise<any[]> {
  const { data: participants, error: pError } = await supabase
    .from('activity_participants')
    .select('*')
    .eq('activity_id', activityId);

  if (pError) throw pError;
  if (!participants || participants.length === 0) return [];

  const personIds = participants.map(p => p.person_id).filter(Boolean);
  const leaderIds = participants.map(p => p.introducer_id).filter(Boolean);

  const [{ data: persons }, { data: leaders }] = await Promise.all([
    supabase.from('persons').select('*').in('id', personIds),
    supabase.from('leaders').select('*').in('id', leaderIds)
  ]);

  return participants.map(p => {
    const person = persons?.find(person => person.id === p.person_id);
    const leader = leaders?.find(leader => leader.id === p.introducer_id);
    
    return {
      ...p,
      person_name: person?.name,
      contact: person?.contact,
      introducer_name: leader?.name,
      persons: person,
      leaders: leader
    };
  });
}

// 获取所有参与记录(带详细信息)
export async function getAllParticipantsWithDetails(): Promise<any[]> {
  const { data, error } = await supabase
    .from('activity_participants')
    .select(`
      *,
      activities!activity_id(name, start_date, location),
      persons!person_id(name, contact),
      leaders!introducer_id(name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((item: any) => ({
    ...item,
    activity_name: item.activities?.name,
    activity_date: item.activities?.start_date,
    activity_location: item.activities?.location,
    person_name: item.persons?.name,
    contact: item.persons?.contact,
    introducer_name: item.leaders?.name,
    is_paid: item.is_paid || false,
    activities: item.activities,
    persons: item.persons,
    leaders: item.leaders
  }));
}

// 删除参与记录
export async function deleteParticipant(activityId: string, personId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_participants')
    .delete()
    .eq('activity_id', activityId)
    .eq('person_id', personId);

  if (error) throw error;
}

// 批量删除参与记录
export async function deleteParticipants(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('activity_participants')
    .delete()
    .in('id', ids);

  if (error) throw error;
}
// ============ 备份相关API ============

// 记录备份日志 (模拟 SQL 生成)
export async function logBackup(filename: string, content: string): Promise<any> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('backup_logs')
    .insert([{
      user_id: userId,
      filename,
      file_content: content,
      status: 'success'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 切换自动备份开关
export async function toggleAutoBackup(enabled: boolean): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('profiles')
    .update({ auto_backup: enabled })
    .eq('id', userId);

  if (error) throw error;
}

// ============ 修改密码相关API ============

export async function updateUserPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
}

// ============ 管理员用户管理API ============

// 获取所有用户资料 (管理员专用)
export async function getAllProfiles(): Promise<any[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 管理员创建用户 (通过 Edge Function)
export async function adminCreateUser(payload: any): Promise<any> {
  const { data, error } = await supabase.functions.invoke('manage-users', {
    body: { action: 'create', payload }
  });

  if (error) {
    const errorMsg = await error?.context?.text();
    throw new Error(errorMsg || error?.message);
  }
  return data;
}

// 管理员更新用户属性 (通过 Edge Function)
export async function adminUpdateUser(userId: string, updates: any): Promise<any> {
  const { data, error } = await supabase.functions.invoke('manage-users', {
    body: { action: 'updateProfile', payload: { userId, updates } }
  });

  if (error) {
    const errorMsg = await error?.context?.text();
    throw new Error(errorMsg || error?.message);
  }
  return data;
}

// 管理员重置用户密码 (通过 Edge Function)
export async function adminResetPassword(userId: string, newPassword: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('manage-users', {
    body: { action: 'resetPassword', payload: { userId, newPassword } }
  });

  if (error) {
    const errorMsg = await error?.context?.text();
    throw new Error(errorMsg || error?.message);
  }
  return data;
}

// 管理员删除用户 (通过 Edge Function)
export async function adminDeleteUser(userId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('manage-users', {
    body: { action: 'delete', payload: { userId } }
  });

  if (error) {
    const errorMsg = await error?.context?.text();
    throw new Error(errorMsg || error?.message);
  }
  return data;
}

// 导出数据库为 SQL (模拟)
export async function exportDatabaseToSql(): Promise<string> {
  const tables = ['activities', 'persons', 'leaders', 'activity_participants', 'activity_leaders'];
  let sql = `-- 秒哒-活动人员管理 数据库备份\n-- 备份时间: ${new Date().toLocaleString()}\n\n`;

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) continue;
    
    if (data && data.length > 0) {
      sql += `-- 表: ${table}\n`;
      for (const row of data) {
        const columns = Object.keys(row).join(', ');
        const values = Object.values(row).map(v => {
          if (v === null) return 'NULL';
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return v;
        }).join(', ');
        sql += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
      }
      sql += '\n';
    }
  }
  
  return sql;
}

// ============ 待办相关API ============

// 获取待办报名列表（未查看的二维码报名）
export async function getPendingRegistrations(): Promise<any[]> {
  const { data: participants, error: pError } = await supabase
    .from('activity_participants')
    .select('*')
    .eq('registration_source', 'qrcode')
    .eq('is_viewed', false)
    .order('created_at', { ascending: false });

  if (pError) throw pError;
  if (!participants || participants.length === 0) return [];

  const activityIds = participants.map(p => p.activity_id).filter(Boolean);
  const personIds = participants.map(p => p.person_id).filter(Boolean);

  const [{ data: activities }, { data: persons }] = await Promise.all([
    supabase.from('activities').select('id, name, start_date, location, status').in('id', activityIds),
    supabase.from('persons').select('id, name, contact, gender, age').in('id', personIds)
  ]);

  return participants.map(p => ({
    ...p,
    activities: activities?.find(a => a.id === p.activity_id),
    persons: persons?.find(person => person.id === p.person_id)
  }));
}

// 标记报名为已查看
export async function markRegistrationAsViewed(participantId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_participants')
    .update({
      is_viewed: true,
      viewed_at: new Date().toISOString(),
    })
    .eq('id', participantId);

  if (error) throw error;
}

// 批量标记报名为已查看
export async function markRegistrationsAsViewed(participantIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('activity_participants')
    .update({
      is_viewed: true,
      viewed_at: new Date().toISOString(),
    })
    .in('id', participantIds);

  if (error) throw error;
}

// 获取待办报名数量
export async function getPendingRegistrationsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('activity_participants')
    .select('*', { count: 'exact', head: true })
    .eq('registration_source', 'qrcode')
    .eq('is_viewed', false);

  if (error) throw error;
  return count || 0;
}

// ============ 活动类型相关API ============

// 获取所有活动类型
export async function getActivityTypes(): Promise<ActivityType[]> {
  const { data, error } = await supabase
    .from('activity_types')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取单个活动类型
export async function getActivityType(id: string): Promise<ActivityType | null> {
  const { data, error } = await supabase
    .from('activity_types')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 创建活动类型
export async function createActivityType(activityType: ActivityTypeFormData): Promise<ActivityType> {
  // 检查名称是否已存在
  const { data: existing, error: checkError } = await supabase
    .from('activity_types')
    .select('id, name')
    .eq('name', activityType.name)
    .maybeSingle();
  
  if (checkError) throw checkError;
  
  if (existing) {
    throw new Error(`活动类型"${activityType.name}"已存在，请使用其他名称`);
  }
  
  const { data, error } = await supabase
    .from('activity_types')
    .insert([activityType])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`活动类型"${activityType.name}"已存在，请使用其他名称`);
    }
    throw error;
  }
  return data;
}

// 更新活动类型
export async function updateActivityType(id: string, activityType: Partial<ActivityTypeFormData>): Promise<ActivityType> {
  // 如果更新了名称，检查是否与其他类型重名
  if (activityType.name) {
    const { data: existing, error: checkError } = await supabase
      .from('activity_types')
      .select('id, name')
      .eq('name', activityType.name)
      .neq('id', id)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    if (existing) {
      throw new Error(`活动类型"${activityType.name}"已存在，请使用其他名称`);
    }
  }
  
  const { data, error } = await supabase
    .from('activity_types')
    .update(activityType)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`活动类型"${activityType.name}"已存在，请使用其他名称`);
    }
    throw error;
  }
  return data;
}

// 删除活动类型
export async function deleteActivityType(id: string): Promise<void> {
  const { error } = await supabase
    .from('activity_types')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============ 领队招募分析相关API ============

// 获取领队招募统计数据
export async function getLeaderRecruitmentStats(activityIds?: string[]): Promise<LeaderRecruitmentStats[]> {
  // 获取所有领队
  const { data: leaders, error: leadersError } = await supabase
    .from('leaders')
    .select('id, name');
  
  if (leadersError) throw leadersError;
  if (!leaders) return [];

  const stats: LeaderRecruitmentStats[] = [];

  for (const leader of leaders) {
    // 获取该领队介绍的所有参与记录（常规活动）
    let apQuery = supabase
      .from('activity_participants')
      .select(`
        id,
        person_id,
        activity_id,
        status,
        activities!activity_id (
          id,
          name,
          type,
          activity_type_id,
          activity_types!activity_type_id (
            name
          )
        )
      `)
      .eq('introducer_id', leader.id);
    
    // 如果提供了活动ID列表，则进行过滤
    if (activityIds && activityIds.length > 0) {
      apQuery = apQuery.in('activity_id', activityIds);
    }

    const { data: participants, error: participantsError } = await apQuery;
    
    if (participantsError) throw participantsError;

    // 获取该领队的线上活动参与记录
    let lpQuery = supabase
      .from('activity_leaders')
      .select(`
        id,
        activity_id,
        participant_count,
        activities!activity_id (
          id,
          name,
          type,
          activity_type_id,
          activity_types!activity_type_id (
            name
          )
        )
      `)
      .eq('leader_id', leader.id);
    
    // 如果提供了活动ID列表，则进行过滤
    if (activityIds && activityIds.length > 0) {
      lpQuery = lpQuery.in('activity_id', activityIds);
    }

    const { data: leaderParticipants, error: lpError } = await lpQuery;
    
    if (lpError) throw lpError;

    // 如果该领队没有任何参与记录，跳过
    if ((!participants || participants.length === 0) && (!leaderParticipants || leaderParticipants.length === 0)) {
      continue;
    }

    // 统计唯一人员数（常规活动）
    const uniquePersons = new Set((participants || []).map(p => p.person_id));
    let totalRecruited = uniquePersons.size;

    // 统计线上活动的参与人数（累加）
    const onlineRecruitedCount = (leaderParticipants || []).reduce((sum, lp) => sum + lp.participant_count, 0);
    totalRecruited += onlineRecruitedCount;

    // 统计唯一活动数（常规活动 + 线上活动）
    const uniqueActivities = new Set([
      ...(participants || []).map(p => p.activity_id),
      ...(leaderParticipants || []).map(lp => lp.activity_id)
    ]);
    const totalActivities = uniqueActivities.size;

    // 统计出勤率（仅统计常规活动，线上活动不计入出勤率）
    const attendedCount = (participants || []).filter(p => p.status === '出席').length;
    const attendanceRate = (participants && participants.length > 0) ? (attendedCount / participants.length) * 100 : null;

    // 统计活动类型分布（常规活动 + 线上活动）
    const activityTypeDistribution: { [key: string]: number } = {};
    (participants || []).forEach(p => {
      const activity = p.activities as any;
      const typeName = activity?.activity_types?.name || activity?.type || '未分类';
      activityTypeDistribution[typeName] = (activityTypeDistribution[typeName] || 0) + 1;
    });
    (leaderParticipants || []).forEach(lp => {
      const activity = lp.activities as any;
      const typeName = activity?.activity_types?.name || activity?.type || '未分类';
      activityTypeDistribution[typeName] = (activityTypeDistribution[typeName] || 0) + lp.participant_count;
    });

    stats.push({
      leader_id: leader.id,
      leader_name: leader.name,
      total_recruited: totalRecruited,
      total_activities: totalActivities,
      attendance_rate: attendanceRate !== null ? Math.round(attendanceRate * 100) / 100 : null,
      activity_type_distribution: activityTypeDistribution,
    });
  }

  // 按招募人数降序排序
  return stats.sort((a, b) => b.total_recruited - a.total_recruited);
}

// 获取领队招募详细信息
export async function getLeaderRecruitmentDetail(leaderId: string) {
  // 获取领队信息
  const { data: leader, error: leaderError } = await supabase
    .from('leaders')
    .select('*')
    .eq('id', leaderId)
    .maybeSingle();
  
  if (leaderError) throw leaderError;
  if (!leader) throw new Error('领队不存在');

  // 获取该领队介绍的所有参与记录
  const { data: participants, error: participantsError } = await supabase
    .from('activity_participants')
    .select(`
      *,
      persons!person_id (*),
      activities!activity_id (
        *,
        activity_types!activity_type_id (name)
      )
    `)
    .eq('introducer_id', leaderId);
  
  if (participantsError) throw participantsError;

  // 获取该领队的线上活动记录
  const { data: leaderParticipants, error: lpError } = await supabase
    .from('activity_leaders')
    .select(`
      *,
      activities!activity_id (
        *,
        activity_types!activity_type_id (name)
      )
    `)
    .eq('leader_id', leaderId);
  
  if (lpError) throw lpError;

  // 按人员分组统计
  const personMap = new Map();
  
  if (participants) {
    participants.forEach((p: any) => {
      const personId = p.person_id;
      if (!personMap.has(personId)) {
        personMap.set(personId, {
          person: p.persons,
          activities: [],
          total_activities: 0,
          attendance_count: 0,
        });
      }
      
      const personData = personMap.get(personId);
      personData.activities.push({
        activity: p.activities,
        status: p.status,
        activity_type: p.activities?.activity_types?.name || p.activities?.type,
      });
      personData.total_activities++;
      if (p.status === '出席') {
        personData.attendance_count++;
      }
    });
  }

  // 计算出勤率
  const recruited_persons = Array.from(personMap.values()).map(p => ({
    ...p,
    attendance_rate: p.total_activities > 0 
      ? Math.round((p.attendance_count / p.total_activities) * 10000) / 100 
      : 0,
  }));

  // 计算总招募人数（常规唯一人员数 + 线上累加人数）
  const online_recruited_count = (leaderParticipants || []).reduce((sum, lp) => sum + lp.participant_count, 0);
  const total_recruited_count = recruited_persons.length + online_recruited_count;

  // 计算总活动次数（常规唯一活动数 + 线上唯一活动数）
  const total_activities_ids = new Set([
    ...(participants || []).map(p => p.activity_id),
    ...(leaderParticipants || []).map(lp => lp.activity_id)
  ]);

  return {
    leader,
    recruited_persons,
    online_recruited_count,
    total_recruited_count,
    total_activities_count: total_activities_ids.size,
    online_activities_summary: leaderParticipants || [],
  };
}

// ============ 用户资料相关API ============

// 获取当前用户资料
export async function getUserProfile() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 更新用户资料
export async function updateUserProfile(updates: {
  username?: string;
  email?: string;
  avatar_url?: string;
}) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 上传用户头像
export async function uploadAvatar(file: File): Promise<string> {
  const userId = await getCurrentUserId();
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}_${Date.now()}.${fileExt}`;
  const filePath = `avatars/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('app-99gqsi7u251d_user_avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('app-99gqsi7u251d_user_avatars')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// ============ 邮件通知相关API ============

// 获取邮件通知任务列表
export async function getEmailNotifications() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('email_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 创建邮件通知任务
export async function createEmailNotification(notification: {
  name: string;
  enabled: boolean;
  schedule_type: 'daily' | 'weekdays' | 'custom';
  schedule_time: string;
  schedule_days?: number[];
  content_types: string[];
}) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('email_notifications')
    .insert({
      user_id: userId,
      ...notification,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 更新邮件通知任务
export async function updateEmailNotification(
  id: string,
  updates: {
    name?: string;
    enabled?: boolean;
    schedule_type?: 'daily' | 'weekdays' | 'custom';
    schedule_time?: string;
    schedule_days?: number[];
    content_types?: string[];
  }
) {
  const { data, error } = await supabase
    .from('email_notifications')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 删除邮件通知任务
export async function deleteEmailNotification(id: string) {
  const { error } = await supabase
    .from('email_notifications')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 获取邮件配置（仅root用户）
export async function getEmailConfig() {
  const { data, error } = await supabase
    .from('email_config')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 保存邮件配置（仅root用户）
export async function saveEmailConfig(config: {
  resend_api_key: string;
  from_email: string;
  from_name: string;
}) {
  // 先尝试获取现有配置
  const existing = await getEmailConfig();

  if (existing) {
    // 更新现有配置
    const { data, error } = await supabase
      .from('email_config')
      .update({
        ...config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  } else {
    // 创建新配置
    const { data, error } = await supabase
      .from('email_config')
      .insert(config)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

// ============ 定时任务相关API ============

// 获取所有定时任务
export async function getScheduledTasks() {
  const { data, error } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取单个定时任务
export async function getScheduledTask(id: string) {
  const { data, error } = await supabase
    .from('scheduled_tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 创建定时任务
export async function createScheduledTask(task: {
  name: string;
  description?: string;
  task_type: string;
  cron_expression: string;
  enabled?: boolean;
  task_config?: Record<string, any>;
}) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('scheduled_tasks')
    .insert({
      ...task,
      created_by: userId,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 更新定时任务
export async function updateScheduledTask(
  id: string,
  updates: {
    name?: string;
    description?: string;
    task_type?: string;
    cron_expression?: string;
    enabled?: boolean;
    task_config?: Record<string, any>;
  }
) {
  const { data, error } = await supabase
    .from('scheduled_tasks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 删除定时任务
export async function deleteScheduledTask(id: string) {
  const { error } = await supabase
    .from('scheduled_tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 获取任务执行日志
export async function getTaskExecutionLogs(taskId?: string, limit = 50) {
  let query = supabase
    .from('task_execution_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (taskId) {
    query = query.eq('task_id', taskId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ============ 表格列配置相关API ============

// 获取页面的列配置
export async function getTableColumnConfigs(pageName: string) {
  const { data, error } = await supabase
    .from('table_column_configs')
    .select('*')
    .eq('page_name', pageName)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取所有页面的列配置
export async function getAllTableColumnConfigs() {
  const { data, error } = await supabase
    .from('table_column_configs')
    .select('*')
    .order('page_name', { ascending: true })
    .order('order_index', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 批量更新列配置
export async function batchUpdateTableColumnConfigs(
  configs: Array<{
    id: string;
    visible?: boolean;
    order_index?: number;
    width?: number | null;
  }>
) {
  const promises = configs.map((config) =>
    supabase
      .from('table_column_configs')
      .update({
        ...config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id)
  );

  const results = await Promise.all(promises);
  const errors = results.filter((r) => r.error);
  
  if (errors.length > 0) {
    throw errors[0].error;
  }
}

// 重置页面列配置为默认值
export async function resetTableColumnConfigs(pageName: string) {
  // 这里可以根据需要实现重置逻辑
  // 暂时不实现，因为需要知道每个页面的默认配置
  throw new Error('重置功能暂未实现');
}

// ============ 系统配置相关API ============

// 获取系统配置
export async function getSystemSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle();

  if (error) throw error;
  return data?.setting_value || null;
}

// 更新系统配置
export async function updateSystemSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('system_settings')
    .update({
      setting_value: value,
      updated_at: new Date().toISOString(),
    })
    .eq('setting_key', key);

  if (error) throw error;
}

// 获取调度器启用状态
export async function getSchedulerEnabled(): Promise<boolean> {
  const value = await getSystemSetting('scheduler_enabled');
  return value === 'true';
}

// 设置调度器启用状态
export async function setSchedulerEnabled(enabled: boolean): Promise<void> {
  await updateSystemSetting('scheduler_enabled', enabled ? 'true' : 'false');
  await updateSystemSetting('scheduler_last_updated', new Date().toISOString());
}

// ==================== 领队参与人数管理（线上活动） ====================

// 获取活动的领队参与人数列表
export async function getLeaderParticipants(activityId: string): Promise<LeaderParticipant[]> {
  const { data, error } = await supabase
    .from('leader_participants')
    .select(`
      *,
      leader:leaders(*)
    `)
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// 添加领队参与人数
export async function addLeaderParticipant(
  activityId: string,
  leaderId: string,
  participantCount: number,
  notes?: string
): Promise<LeaderParticipant> {
  const { data, error } = await supabase
    .from('leader_participants')
    .insert({
      activity_id: activityId,
      leader_id: leaderId,
      participant_count: participantCount,
      notes: notes || null,
    })
    .select(`
      *,
      leader:leaders(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

// 更新领队参与人数
export async function updateLeaderParticipant(
  id: string,
  participantCount: number,
  notes?: string
): Promise<LeaderParticipant> {
  const { data, error } = await supabase
    .from('leader_participants')
    .update({
      participant_count: participantCount,
      notes: notes || null,
    })
    .eq('id', id)
    .select(`
      *,
      leader:leaders(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

// 增加领队参与人数（+1 功能）
export async function incrementLeaderParticipantCount(id: string, increment: number = 1): Promise<LeaderParticipant> {
  // 先获取当前数据
  const { data: current, error: fetchError } = await supabase
    .from('leader_participants')
    .select('participant_count')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const newCount = Math.max(0, (current?.participant_count || 0) + increment);

  const { data, error } = await supabase
    .from('leader_participants')
    .update({ participant_count: newCount })
    .eq('id', id)
    .select(`
      *,
      leader:leaders(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

// 删除领队参与人数
export async function deleteLeaderParticipant(id: string): Promise<void> {
  const { error } = await supabase
    .from('leader_participants')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 获取活动的总参与人数（根据活动类型自动计算）
export async function getActivityParticipantCount(activityId: string): Promise<number> {
  const { data, error } = await supabase
    .rpc('get_activity_participant_count', { activity_uuid: activityId });

  if (error) throw error;
  return data || 0;
}

// 获取新增参与人员报表（支持日期范围）
export async function getParticipantsByDateRange(startDate: string, endDate: string) {
  // 构造起始和结束时间
  const start = `${startDate}T00:00:00Z`;
  const end = `${endDate}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from('activity_participants')
    .select(`
      *,
      activities!activity_id(name),
      persons!person_id(name, contact),
      introducers:leaders!introducer_id(name)
    `)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // 转换数据格式以适配前端表格
  return (data || []).map((item: any) => ({
    id: item.id,
    activity_name: item.activities?.name || '未知活动',
    person_name: item.persons?.name || '未知人员',
    person_contact: item.persons?.contact || '-',
    introducer_name: item.introducers?.name || '直接报名',
    status: item.status,
    created_at: item.created_at,
    notes: item.notes
  }));
}

// ============ 数据备份相关API ============// 执行数据库备份
export async function backupDatabase(): Promise<{ sql: string; filename: string; tableCount: number; dataTableCount: number; timestamp: string }> {
  const { data, error } = await supabase.functions.invoke('backup-database', {
    method: 'POST',
  });

  if (error) {
    const errorMsg = await error?.context?.text?.();
    console.error('数据库备份失败:', errorMsg || error?.message);
    throw new Error(errorMsg || error?.message || '数据库备份失败');
  }

  if (!data.success) {
    throw new Error(data.error || '数据库备份失败');
  }

  return {
    sql: data.sql,
    filename: data.filename,
    tableCount: data.tableCount,
    dataTableCount: data.dataTableCount,
    timestamp: data.timestamp,
  };
}

// 获取备份历史记录
export async function getBackupLogs(): Promise<Array<{
  id: string;
  filename: string;
  created_at: string;
  status: string;
  file_content: string;
}>> {
  const { data, error } = await supabase
    .from('backup_logs')
    .select('id, filename, created_at, status, file_content')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 删除备份记录
export async function deleteBackupLog(id: string): Promise<void> {
  const { error } = await supabase
    .from('backup_logs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============ 推广任务相关API ============

// 获取所有推广任务设置
export async function getPromotionTasks(): Promise<PromotionTask[]> {
  const { data, error } = await supabase
    .from('promotion_tasks')
    .select('*')
    .order('promotion_time', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 创建推广任务
export async function createPromotionTask(task: PromotionTaskFormData): Promise<PromotionTask> {
  const { data, error } = await supabase
    .from('promotion_tasks')
    .insert([task])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('该任务已存在');
    }
    throw error;
  }
  return data;
}

// 更新推广任务
export async function updatePromotionTask(id: string, task: PromotionTaskFormData): Promise<PromotionTask> {
  const { data, error } = await supabase
    .from('promotion_tasks')
    .update({ ...task, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 删除推广任务（关联的每日记录会级联删除）
export async function deletePromotionTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('promotion_tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 获取指定日期范围的推广任务记录
export async function getPromotionTaskRecordsByDateRange(startDate: string, endDate: string): Promise<PromotionTaskRecord[]> {
  const { data, error } = await supabase
    .from('promotion_task_records')
    .select('*')
    .gte('record_date', startDate)
    .lte('record_date', endDate);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 设置某天任务的完成状态（不存在则创建），返回该记录
export async function upsertPromotionTaskRecord(params: {
  task_id: string;
  record_date: string;
  is_completed: boolean;
  notes?: string | null;
}): Promise<PromotionTaskRecord> {
  const { data, error } = await supabase
    .from('promotion_task_records')
    .upsert(params, { onConflict: 'task_id,record_date' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 获取指定记录 id 集合对应的实际推广详情
export async function getPromotionTaskDetails(recordIds: string[]): Promise<PromotionTaskDetail[]> {
  if (recordIds.length === 0) return [];
  const { data, error } = await supabase
    .from('promotion_task_details')
    .select('*')
    .in('record_id', recordIds);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取或创建某条记录的实际推广详情（不存在则按默认值创建）
export async function getOrCreatePromotionTaskDetail(
  recordId: string,
  defaults: { actual_time?: string | null; activity_ids?: string | null }
): Promise<PromotionTaskDetail> {
  const { data: existing } = await supabase
    .from('promotion_task_details')
    .select('*')
    .eq('record_id', recordId)
    .maybeSingle();

  if (existing) return existing;

  const { data: inserted, error } = await supabase
    .from('promotion_task_details')
    .insert({
      record_id: recordId,
      actual_time: defaults.actual_time ?? null,
      activity_ids: defaults.activity_ids ?? '',
      channel: '',
      conversions: 0,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return inserted!;
}

// 保存实际推广详情（不存在则创建，存在则更新）
export async function upsertPromotionTaskDetail(
  recordId: string,
  detail: PromotionTaskDetailFormData
): Promise<PromotionTaskDetail> {
  const { data, error } = await supabase
    .from('promotion_task_details')
    .upsert(
      {
        record_id: recordId,
        actual_time: detail.actual_time ?? null,
        activity_ids: detail.activity_ids ?? '',
        channel: detail.channel ?? '',
        conversions: detail.conversions ?? 0,
      },
      { onConflict: 'record_id' }
    )
    .select()
    .maybeSingle();

  if (error) throw error;
  return data!;
}


