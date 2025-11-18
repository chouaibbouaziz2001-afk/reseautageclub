-- Row Level Security (RLS) Policies
-- Security enhancement for Supabase tables

-- IMPORTANT: Run these after creating your tables
-- These policies ensure users can only access their own data or public data

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" 
  ON profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Posts policies
CREATE POLICY "Posts are viewable by everyone" 
  ON posts FOR SELECT 
  USING (true);

CREATE POLICY "Users can create posts" 
  ON posts FOR INSERT 
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own posts" 
  ON posts FOR UPDATE 
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own posts" 
  ON posts FOR DELETE 
  USING (auth.uid() = author_id);

-- Post likes policies
CREATE POLICY "Post likes are viewable by everyone" 
  ON post_likes FOR SELECT 
  USING (true);

CREATE POLICY "Users can create post likes" 
  ON post_likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own post likes" 
  ON post_likes FOR DELETE 
  USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" 
  ON comments FOR SELECT 
  USING (true);

CREATE POLICY "Users can create comments" 
  ON comments FOR INSERT 
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own comments" 
  ON comments FOR UPDATE 
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own comments" 
  ON comments FOR DELETE 
  USING (auth.uid() = author_id);

-- Communities policies
CREATE POLICY "Public communities viewable by everyone" 
  ON communities FOR SELECT 
  USING (
    NOT is_private OR 
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create communities" 
  ON communities FOR INSERT 
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Admins can update communities" 
  ON communities FOR UPDATE 
  USING (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Community members policies
CREATE POLICY "Community members viewable by members" 
  ON community_members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_id 
      AND (
        NOT c.is_private OR 
        c.creator_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM community_members cm2
          WHERE cm2.community_id = c.id AND cm2.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can join communities" 
  ON community_members FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM communities 
      WHERE id = community_id AND NOT is_private
    )
  );

CREATE POLICY "Users can leave communities" 
  ON community_members FOR DELETE 
  USING (auth.uid() = user_id);

-- Messages policies (private 1-on-1)
CREATE POLICY "Users can view own messages" 
  ON messages FOR SELECT 
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id
  );

CREATE POLICY "Users can send messages" 
  ON messages FOR INSERT 
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own messages" 
  ON messages FOR UPDATE 
  USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete own messages" 
  ON messages FOR DELETE 
  USING (auth.uid() = sender_id);

-- Connections policies
CREATE POLICY "Users can view connections" 
  ON connections FOR SELECT 
  USING (
    auth.uid() = user_id OR 
    auth.uid() = connected_user_id
  );

CREATE POLICY "Users can create connections" 
  ON connections FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections" 
  ON connections FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections" 
  ON connections FOR DELETE 
  USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" 
  ON notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" 
  ON notifications FOR DELETE 
  USING (auth.uid() = user_id);

-- Storage bucket policies
-- For user uploads (avatars, post media, etc.)

-- User media bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('users-media', 'users-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own media" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'users-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own media" 
  ON storage.objects FOR UPDATE 
  USING (
    bucket_id = 'users-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own media" 
  ON storage.objects FOR DELETE 
  USING (
    bucket_id = 'users-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Media is publicly viewable" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'users-media');

-- Note: Adjust these policies based on your specific requirements
-- Test thoroughly before deploying to production
