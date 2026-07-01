import fs from 'fs';
import path from 'path';

interface ModelData {
  priors: Record<string, number>;
  likelihoods: Record<string, Record<string, number>>;
  vocabSize: number;
}

const MODEL_PATH = path.join(process.cwd(), 'src/services/nexus-model.json');

const TRAINING_DATA: { intent: string; text: string }[] = [
  // FINANCE
  { intent: 'FINANCE', text: 'outstanding invoices monawada' },
  { intent: 'FINANCE', text: 'total payables' },
  { intent: 'FINANCE', text: 'finance details' },
  { intent: 'FINANCE', text: 'outstanding invoices sum' },
  { intent: 'FINANCE', text: 'higa invoice kiyada' },
  { intent: 'FINANCE', text: 'outstanding invoices pramanya' },
  { intent: 'FINANCE', text: 'outstanding balance sheet' },
  { intent: 'FINANCE', text: 'how much is outstanding' },
  { intent: 'FINANCE', text: 'outstanding value' },
  { intent: 'FINANCE', text: 'higa mudala' },

  // PROJECTS
  { intent: 'PROJECTS', text: 'active projects details' },
  { intent: 'PROJECTS', text: 'overdue tasks' },
  { intent: 'PROJECTS', text: 'delayed projects' },
  { intent: 'PROJECTS', text: 'project status' },
  { intent: 'PROJECTS', text: 'pramada vi athi wada' },
  { intent: 'PROJECTS', text: 'overdue tasks count' },
  { intent: 'PROJECTS', text: 'how many active projects' },
  { intent: 'PROJECTS', text: 'delayed tasks info' },
  { intent: 'PROJECTS', text: 'project delay' },

  // INVENTORY_LOW
  { intent: 'INVENTORY_LOW', text: 'low stock items' },
  { intent: 'INVENTORY_LOW', text: 'adu stock thiyeda' },
  { intent: 'INVENTORY_LOW', text: 'low stock' },
  { intent: 'INVENTORY_LOW', text: 'inventory alerts' },
  { intent: 'INVENTORY_LOW', text: 'low stock materials' },
  { intent: 'INVENTORY_LOW', text: 'low stock items list' },
  { intent: 'INVENTORY_LOW', text: 'stock adu wuna ewade' },
  { intent: 'INVENTORY_LOW', text: 'low stocks' },

  // CONTRACTORS
  { intent: 'CONTRACTORS', text: 'how many registered contractors' },
  { intent: 'CONTRACTORS', text: 'contractors count' },
  { intent: 'CONTRACTORS', text: 'registered contractors list' },
  { intent: 'CONTRACTORS', text: 'liyapadinchi contractorla kiyada' },
  { intent: 'CONTRACTORS', text: 'contractor pramanya' },
  { intent: 'CONTRACTORS', text: 'how many contractors' },
  { intent: 'CONTRACTORS', text: 'registered contractors' },
  { intent: 'CONTRACTORS', text: 'registed contractors' },

  // STORES
  { intent: 'STORES', text: 'how many active stores' },
  { intent: 'STORES', text: 'gabadu gana kiyada' },
  { intent: 'STORES', text: 'stores count' },
  { intent: 'STORES', text: 'active warehouses' },
  { intent: 'STORES', text: 'gabadawa' },
  { intent: 'STORES', text: 'gabadawal kiyak thiyeda' },
  { intent: 'STORES', text: 'active store' },

  // INVENTORY_ITEMS
  { intent: 'INVENTORY_ITEMS', text: 'total materials info' },
  { intent: 'INVENTORY_ITEMS', text: 'items count' },
  { intent: 'INVENTORY_ITEMS', text: 'total inventory items' },
  { intent: 'INVENTORY_ITEMS', text: 'muluku dravya pramanya' },
  { intent: 'INVENTORY_ITEMS', text: 'dravya kiyak thiyeda' },
  { intent: 'INVENTORY_ITEMS', text: 'materials list' },
  { intent: 'INVENTORY_ITEMS', text: 'inventory item' },

  // PROCUREMENT
  { intent: 'PROCUREMENT', text: 'pending requisitions kiyada' },
  { intent: 'PROCUREMENT', text: 'purchase orders count' },
  { intent: 'PROCUREMENT', text: 'pr and po status' },
  { intent: 'PROCUREMENT', text: 'pending grn' },
  { intent: 'PROCUREMENT', text: 'requisitions' },
  { intent: 'PROCUREMENT', text: 'purchase order' },
  { intent: 'PROCUREMENT', text: 'goods receipt count' },
  { intent: 'PROCUREMENT', text: 'pr and po' },

  // VOUCHERS
  { intent: 'VOUCHERS', text: 'how many pending payment vouchers' },
  { intent: 'VOUCHERS', text: 'payment vouchers to approve' },
  { intent: 'VOUCHERS', text: 'pending pvs' },
  { intent: 'VOUCHERS', text: 'pv pramanya' },
  { intent: 'VOUCHERS', text: 'payment voucher status' },
  { intent: 'VOUCHERS', text: 'approve karanna thiyena vouchers' },
  { intent: 'VOUCHERS', text: 'payment voucher' }
];

const DYNAMIC_TRAINING_PATH = path.join(process.cwd(), 'src/services/nexus-training-data.json');

export class NexusClassifierService {
  /**
   * Tokenize text into words
   */
  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0d80-\u0dff]/g, '') // strip punctuation keeping English/Sinhala characters
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  /**
   * Retrieves all training data (Static + Dynamic learned over time)
   */
  private static async getTrainingData(): Promise<{ intent: string; text: string }[]> {
    let dynamicData: { intent: string; text: string }[] = [];
    try {
      if (fs.existsSync(DYNAMIC_TRAINING_PATH)) {
        dynamicData = JSON.parse(await fs.promises.readFile(DYNAMIC_TRAINING_PATH, 'utf-8'));
      }
    } catch (e) {
      console.warn("[CLASSIFIER] Could not parse dynamic training data:", e);
    }
    return [...TRAINING_DATA, ...dynamicData];
  }

  /**
   * Adds a new example to the dynamic dataset and triggers retraining
   */
  static async addTrainingExample(intent: string, text: string): Promise<void> {
    let dynamicData: { intent: string; text: string }[] = [];
    try {
      if (fs.existsSync(DYNAMIC_TRAINING_PATH)) {
        dynamicData = JSON.parse(await fs.promises.readFile(DYNAMIC_TRAINING_PATH, 'utf-8'));
      }
    } catch (e) {}

    // Avoid exact duplicate reinforcement 
    if (!dynamicData.find(d => d.text === text && d.intent === intent) && !TRAINING_DATA.find(d => d.text === text && d.intent === intent)) {
        dynamicData.push({ intent, text });
        await fs.promises.writeFile(DYNAMIC_TRAINING_PATH, JSON.stringify(dynamicData, null, 2), 'utf-8');
        await this.train();
    }
  }

  /**
   * Starts a continuous background training loop interval
   */
  static startContinuousTraining(intervalMs: number = 3600000): void {
    setInterval(() => {
        this.train().catch(err => console.error("[CLASSIFIER] Continuous training error:", err));
    }, intervalMs);
    console.log(`[CLASSIFIER] Continuous background training started (Interval: ${intervalMs}ms)`);
  }

  /**
   * Trains the Naive Bayes model on all data and saves parameters to nexus-model.json
   */
  static async train(): Promise<void> {
    const allData = await this.getTrainingData();
    const documentCount = allData.length;
    const classCounts: Record<string, number> = {};
    const wordCountsPerClass: Record<string, Record<string, number>> = {};
    const vocab = new Set<string>();

    // 1. Count frequencies
    for (const doc of allData) {
      const tokens = this.tokenize(doc.text);
      classCounts[doc.intent] = (classCounts[doc.intent] || 0) + 1;

      if (!wordCountsPerClass[doc.intent]) {
        wordCountsPerClass[doc.intent] = {};
      }

      for (const token of tokens) {
        vocab.add(token);
        wordCountsPerClass[doc.intent][token] = (wordCountsPerClass[doc.intent][token] || 0) + 1;
      }
    }

    const vocabSize = vocab.size;
    const priors: Record<string, number> = {};
    const likelihoods: Record<string, Record<string, number>> = {};

    // 2. Compute priors and likelihoods with Laplace smoothing
    for (const intent in classCounts) {
      priors[intent] = classCounts[intent] / documentCount;

      const totalWordsInClass = Object.values(wordCountsPerClass[intent]).reduce((a, b) => a + b, 0);
      likelihoods[intent] = {};

      for (const word of vocab) {
        const count = wordCountsPerClass[intent][word] || 0;
        likelihoods[intent][word] = (count + 1) / (totalWordsInClass + vocabSize);
      }
    }

    const modelData: ModelData = { priors, likelihoods, vocabSize };

    // Save model parameters to disk
    await fs.promises.writeFile(MODEL_PATH, JSON.stringify(modelData, null, 2), 'utf-8');
    console.log(`[CLASSIFIER] Model trained successfully on ${documentCount} documents. Vocab size: ${vocabSize}`);
  }

  /**
   * Predict the intent of a query using the trained model
   */
  static predict(message: string): string {
    let model: ModelData;

    try {
      if (fs.existsSync(MODEL_PATH)) {
        model = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf-8'));
      } else {
        // Fallback to training dynamically in-memory if file does not exist
        return this.predictInMemory(message);
      }
    } catch (e) {
      console.error("[CLASSIFIER] Failed to load model file, falling back:", e);
      return this.predictInMemory(message);
    }

    const tokens = this.tokenize(message);
    let bestIntent = 'UNKNOWN';
    let bestScore = -Infinity;

    for (const intent in model.priors) {
      // Start with log of prior probability
      let score = Math.log(model.priors[intent]);

      for (const token of tokens) {
        // Retrieve probability or default with Laplace smoothing
        const p = model.likelihoods[intent]?.[token] || (1 / (model.vocabSize + 1));
        score += Math.log(p);
      }

      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    return bestIntent;
  }

  /**
   * In-memory dynamic prediction fallback
   */
  private static predictInMemory(message: string): string {
    const tokens = this.tokenize(message);
    let bestIntent = 'UNKNOWN';
    let maxMatchCount = 0;

    // Simple word overlap fallback
    for (const intent of ['FINANCE', 'PROJECTS', 'INVENTORY_LOW', 'CONTRACTORS', 'STORES', 'INVENTORY_ITEMS', 'PROCUREMENT', 'VOUCHERS']) {
      const examples = TRAINING_DATA.filter(t => t.intent === intent);
      let matchCount = 0;

      for (const ex of examples) {
        const exTokens = this.tokenize(ex.text);
        const intersection = tokens.filter(t => exTokens.includes(t));
        matchCount += intersection.length;
      }

      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        bestIntent = intent;
      }
    }

    return maxMatchCount > 0 ? bestIntent : 'UNKNOWN';
  }
}
