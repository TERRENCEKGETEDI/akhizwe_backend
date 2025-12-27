const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rkuzqajmxnatyulwoxzy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdXpxYWpteG5hdHl1bHdveHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODQ3NjcsImV4cCI6MjA4MjM2MDc2N30.vGNaNmfhVd8YvLIhHyr0vCeaM-qshoJnKqEsKv0gsjM'
);

(async () => {
  try {
    console.log('Testing signed URL generation...');
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUrl(
        '1766797668323_ebafc778e2eb2a1c15958a8cd874158f.mp4',
        3600
      );

    console.log('Data:', data);
    console.log('Error:', error);
  } catch (e) {
    console.log('Exception:', e);
  }
})();