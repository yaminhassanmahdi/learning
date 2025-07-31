import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://gzubzmayzyvjmxqgympo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dWJ6bWF5enl2am14cWd5bXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwODI4NjcsImV4cCI6MjA1ODY1ODg2N30.gFECAtGAIdG1CQw7uO1cr_9fSpZSJAfktAULEXeVZZA';

export const supabase = createClient(supabaseUrl, supabaseKey);
