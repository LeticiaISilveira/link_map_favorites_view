class SimpleKeywordClassifier {
  constructor() {
    this.data = {};
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z0-9]+/g) || [];
  }

  train(category, text) {
    if (!this.data[category]) {
      this.data[category] = {};
    }
    const words = this.tokenize(text);
    words.forEach(word => {
      this.data[category][word] = (this.data[category][word] || 0) + 1;
    });
  }

  classify(input) {
    const signals = Array.isArray(input)
      ? input
      : [{ text: input, weight: 1 }];
    let bestCategory = 'General';
    let highestScore = 0;

    for (const category in this.data) {
      const score = signals.reduce((signalScore, signal) => {
        const words = [...new Set(this.tokenize(signal.text))];
        return signalScore + words.reduce((total, word) => {
          const frequency = this.data[category][word] || 0;
          if (!frequency) {
            return total;
          }

          const categoryCount = Object.values(this.data)
            .filter(categoryData => categoryData[word])
            .length;
          const distinctiveness = Math.log1p(Object.keys(this.data).length / categoryCount);
          return total + Math.log1p(frequency) * distinctiveness * signal.weight;
        }, 0);
      }, 0);

      if (score > highestScore) {
        highestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }
}

// Create the classifier and expose it in the browser's global scope.
const classifier = new SimpleKeywordClassifier();
classifier.train('Development', 'github stackoverflow react javascript python api code git sql css html npm node');
classifier.train('Artificial Intelligence', 'chatgpt openai anthropic ai ml machinelearning huggingface midjourney llm artificial');
classifier.train('Design & UI', 'figma dribbble behance ui ux tailwind color icon font design webdesign');
classifier.train('Finance', 'bank banking invest investment stocks stockmarket reits finance financial business money crypto cryptocurrency trading portfolio savings loan mortgage budget tax accounting payment stripe');
classifier.train('Study & Reading', 'medium notion substack article course courses tutorial tutorials docs documentation pdf ebook book books study studies learning education school university college lecture research paper academic python programming language languages idioma idiomas estudo estudos curso cursos aprendizado educacao escola universidade faculdade aula aulas leitura livro livros learn lesson lessons homework exam notes science mathematics math history literature');
classifier.train('Languages & Translation', 'duolingo babbel busuu memrise rosetta lingodeer language languages idioma idiomas spanish french english german italian portuguese japanese korean chinese arabic vocabulary grammar conjugation pronunciation translation translate translator dictionary words speaking listening reading writing verbos vocabulario gramatica traducao tradutor dicionario ingles espanhol frances alemao japones');
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