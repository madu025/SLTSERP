export class SODReturnClassifierService {
  private static rules = [
    { 
      category: 'CUSTOMER_ABSENT', 
      keywords: ['home', 'absent', 'no answer', 'busy', 'response', 'gedara', 'kawruth', 'not available', 'ready', 'customer delay', 'nocust', 'no response', 'not at home'] 
    },
    { 
      category: 'MATERIAL_SHORTAGE', 
      keywords: ['stock', 'madi', 'cable', 'short', 'shortage', 'splitter', 'router', 'ont', 'item', 'accessories', 'badu madi', 'no wire', 'material limit'] 
    },
    { 
      category: 'PORT_SHORTAGE', 
      keywords: ['port', 'dp port', 'full', 'no free', 'connection limit', 'ports short', 'dp full'] 
    },
    { 
      category: 'INFRASTRUCTURE_ISSUE', 
      keywords: ['pole', 'block', 'heavy', 'rain', 'damaged', 'line', 'distance', 'exceed', 'woro', 'underground', 'jumper', 'weather', 'power', 'no signal', 'signal issue'] 
    }
  ];

  /**
   * Classifies a raw return comment into standard categories
   */
  static classify(comment: string): { category: string; originalComment: string } {
    if (!comment) {
      return { category: 'OTHER', originalComment: '' };
    }

    const cleanComment = comment.toLowerCase();
    let bestCategory = 'OTHER';
    let maxMatch = 0;

    for (const rule of this.rules) {
      let matches = 0;
      for (const keyword of rule.keywords) {
        if (cleanComment.includes(keyword)) {
          matches++;
        }
      }
      if (matches > maxMatch) {
        maxMatch = matches;
        bestCategory = rule.category;
      }
    }

    return {
      category: bestCategory,
      originalComment: comment
    };
  }
}
