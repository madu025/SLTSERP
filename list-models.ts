import dotenv from 'dotenv';
dotenv.config();
const apiKey = process.env.GEMINI_API_KEY;
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    .then(res => res.json())
    .then((data: { models: { name: string }[] }) => console.log(data.models.map((m: { name: string }) => m.name).filter((n: string) => n.includes('gemini'))));
