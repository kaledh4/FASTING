import os
import json
import requests
from datetime import datetime

# Configuration
API_KEY = os.environ.get('NEWS_API_KEY')
# Fallback if no key is provided (for testing or if secret is missing)
# In production, this should come from secrets.
OUTPUT_FILE = 'data/daily_news.json'

def fetch_health_news():
    if not API_KEY:
        print("No API Key found. Generating static fallback data.")
        return generate_fallback_data()

    url = f"https://newsapi.org/v2/top-headlines?category=health&language=ar&apiKey={API_KEY}"
    
    try:
        response = requests.get(url)
        data = response.json()
        
        if data.get('status') == 'ok':
            return {
                "updated_at": datetime.now().isoformat(),
                "tip": "نصيحة اليوم: المشي لمدة 30 دقيقة يومياً يقلل من خطر الإصابة بأمراض القلب.",
                "articles": data.get('articles', [])[:5] # Top 5 articles
            }
        else:
            print(f"API Error: {data}")
            return generate_fallback_data()
            
    except Exception as e:
        print(f"Error fetching news: {e}")
        return generate_fallback_data()

def generate_fallback_data():
    return {
        "updated_at": datetime.now().isoformat(),
        "tip": "نصيحة اليوم: شرب الماء بانتظام يساعد على تحسين التركيز والطاقة.",
        "articles": [
            {
                "title": "فوائد الصيام المتقطع للصحة العقلية",
                "description": "دراسات جديدة تؤكد دور الصيام في تحسين الوظائف الإدراكية.",
                "url": "#",
                "urlToImage": "https://via.placeholder.com/300?text=Health"
            },
            {
                "title": "أهمية النوم الجيد للمناعة",
                "description": "النوم لمدة 7-8 ساعات يعزز جهاز المناعة بشكل كبير.",
                "url": "#",
                "urlToImage": "https://via.placeholder.com/300?text=Sleep"
            }
        ]
    }

if __name__ == "__main__":
    news_data = fetch_health_news()
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(news_data, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully updated {OUTPUT_FILE}")
