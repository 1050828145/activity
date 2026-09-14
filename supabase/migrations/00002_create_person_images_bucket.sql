-- 创建人员照片存储桶
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-99gqsi7u251d_person_images',
  'app-99gqsi7u251d_person_images',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
);

-- 允许所有用户上传图片
CREATE POLICY "Allow public upload"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'app-99gqsi7u251d_person_images');

-- 允许所有用户查看图片
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'app-99gqsi7u251d_person_images');

-- 允许所有用户删除图片
CREATE POLICY "Allow public delete"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'app-99gqsi7u251d_person_images');