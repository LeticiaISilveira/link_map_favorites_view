class SimpleBayesClassifier {
  constructor() {
    this.data = {};
    this.totals = {};
  }

  train(category, text) {
    if (!this.data[category]) {
      this.data[category] = {};
      this.totals[category] = 0;
    }
    const words = text.toLowerCase().match(/\w+/g) || [];
    words.forEach(word => {
      this.data[category][word] = (this.data[category][word] || 0) + 1;
      this.totals[category]++;
    });
  }

  classify(text) {
    const words = text.toLowerCase().match(/\w+/g) || [];
    let bestCategory = 'General';
    let highestProbability = -Infinity;

    for (const category in this.data) {
      let probability = 0;
      words.forEach(word => {
        const frequency = (this.data[category][word] || 0) + 1;
        const total = this.totals[category] + Object.keys(this.data[category]).length;
        probability += Math.log(frequency / total);
      });

      if (probability > highestProbability) {
        highestProbability = probability;
        bestCategory = category;
      }
    }

    return bestCategory;
  }
}

// Create the classifier and expose it in the browser's global scope.
const classifier = new SimpleBayesClassifier();
classifier.train('Development', 'github stackoverflow react javascript python api code git sql css html npm node');
classifier.train('Artificial Intelligence', 'chatgpt openai anthropic ai ml machinelearning huggingface midjourney llm artificial');
classifier.train('Design & UI', 'figma dribbble behance ui ux tailwind color icon font design webdesign');
classifier.train('Finance', 'bank invest stocks reits stripe finance business money crypto');
classifier.train('Study & Reading', 'medium notion substack article course tutorial docs pdf book study');
classifier.train('Shopping & Retail', 'ikea amazon ebay etsy aliexpress walmart target shop store shopping retail product price order checkout furniture sofa chair table bed mattress kitchen decor homeware');
classifier.train('Travel', 'airbnb booking expedia tripadvisor kayak skyscanner hotel flight airline travel vacation holiday resort rental hostel destination');
classifier.train('News', 'bbc cnn reuters nytimes guardian washingtonpost news newspaper journalism headlines politics world breaking');
classifier.train('Social Media', 'facebook instagram tiktok x twitter linkedin reddit pinterest social media post profile followers feed');
classifier.train('Entertainment', 'youtube netflix disneyplus spotify twitch imdb music movie movies series streaming games gaming');
classifier.train('Food & Recipes', 'allrecipes foodnetwork delish recipe cooking kitchen ingredients meal restaurant delivery doordash ubereats');
classifier.train('Health & Fitness', 'webmd health mayo clinic medical doctor fitness workout exercise gym nutrition wellness');
classifier.train('Communication', 'gmail outlook protonmail email mail zoom slack discord teams messaging chat meeting video call');
classifier.train('Cloud & Storage', 'google drive dropbox onedrive icloud cloud storage backup files document spreadsheet');

window.classifier = classifier;