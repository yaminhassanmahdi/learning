# Vercel Environment Variables for EdTech Platform

## 🔧 **Required Environment Variables for Vercel Deployment**

Add these environment variables in your Vercel project dashboard under **Settings > Environment Variables**

---

## 🌐 **Supabase Configuration**
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

---

## 🤖 **Google AI (Gemini) API**
```
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key_here
```

---

## 💳 **Stripe Payment Configuration**
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
STRIPE_SECRET_KEY=your_stripe_secret_key_here
```

---

## 📄 **Document Processing APIs**
```
NEXT_PUBLIC_CONVERTAPI_SECRET=your_convertapi_secret_here
```

---

## 🎨 **AI Image Generation**
```
NEXT_PUBLIC_NOVITA_API_KEY=your_novita_api_key_here
```

---

## 🤗 **Hugging Face AI**
```
NEXT_PUBLIC_HF_TOKEN=your_huggingface_token_here
```

---

## 🔍 **OpenAI (Optional - for some features)**
```
OPENAI_API_KEY=your_openai_api_key_here
```

---

## 📊 **Redis (Optional - for caching)**
```
UPSTASH_REDIS_REST_URL=your_redis_url_here
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here
```

---

## 🎯 **AssemblyAI (Optional - for transcription)**
```
ASSEMBLYAI_API_KEY=your_assemblyai_key_here
```

---

## 📝 **How to Add Environment Variables in Vercel:**

1. **Go to your Vercel dashboard**
2. **Select your project**
3. **Go to Settings > Environment Variables**
4. **Add each variable with its value**
5. **Set environment to "Production" (and optionally "Preview" and "Development")**
6. **Click "Save"**

---

## 🚀 **Deployment Steps:**

1. **Connect your GitHub repository** to Vercel
2. **Add all environment variables** listed above
3. **Deploy** - Vercel will automatically build and deploy your app
4. **Your app will be available** at your Vercel domain

---

## ⚠️ **Important Notes:**

- **Replace placeholder values** with your actual API keys
- **Keep API keys secure** - never commit them to your repository
- **Test in development** before deploying to production
- **Monitor usage** of your API keys to avoid unexpected charges

---

## 🔐 **Security Best Practices:**

- Use **test keys** for development
- Use **production keys** only for live deployment
- **Rotate keys** regularly
- **Monitor API usage** and set up alerts
- **Use environment-specific keys** (dev/staging/prod)

---

## 📞 **Support:**

If you encounter issues:
1. Check Vercel deployment logs
2. Verify all environment variables are set correctly
3. Ensure API keys are valid and have proper permissions
4. Check Supabase database connection

---

## 🎉 **Your app will be live at:**
`https://your-project-name.vercel.app` 