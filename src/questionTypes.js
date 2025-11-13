// Question Types - Modular question type system
// This file is separate from GameScene so it can be imported in the lobby without loading Phaser

// NOTE: The generate() functions use Phaser, so they can only be called when Phaser is loaded
// But the metadata (name, category) can be accessed anytime for UI display

export const QUESTION_TYPES = {
    // Addition crossing over 10 (result between 10-30)
    additionCrossing10: {
        name: 'Addisjon over 10',
        category: 'addition',
        generate: () => {
            // Pick two numbers that add to between 10-30
            // One number should be less than 10 to ensure crossing
            const num1 = Phaser.Math.Between(4, 9);
            const num2 = Phaser.Math.Between(Math.max(1, 10 - num1), 25);
            const answer = num1 + num2;

            // Only return if answer is in desired range
            if (answer >= 10 && answer <= 30) {
                return {
                    question: `${num1} + ${num2}`,
                    answer: answer.toString()
                };
            }
            // Retry if not in range
            return QUESTION_TYPES.additionCrossing10.generate();
        }
    },

    // Subtraction crossing under 20 or 10 (starting 10-30, crossing down)
    subtractionCrossing: {
        name: 'Subtraksjon over 10/20',
        category: 'subtraction',
        generate: () => {
            // Start with number between 11-30
            const num1 = Phaser.Math.Between(11, 30);

            // Subtract enough to cross under 10 or 20
            let num2;
            if (num1 >= 20) {
                // Cross under 20: result between 10-19
                num2 = Phaser.Math.Between(Math.max(1, num1 - 19), Math.min(num1 - 10, 15));
            } else {
                // Cross under 10: result between 1-9
                num2 = Phaser.Math.Between(Math.max(1, num1 - 9), Math.min(num1 - 1, 15));
            }

            const answer = num1 - num2;

            // Validate result is positive and in expected range
            if (answer >= 1 && answer <= 30) {
                return {
                    question: `${num1} - ${num2}`,
                    answer: answer.toString()
                };
            }
            // Retry if not valid
            return QUESTION_TYPES.subtractionCrossing.generate();
        }
    },

    // Multiplication 1-5 tables
    multiplication1to5: {
        name: 'Multiplikasjon 1-5',
        category: 'multiplication',
        generate: () => {
            const num1 = Phaser.Math.Between(1, 5);
            const num2 = Phaser.Math.Between(1, 10);
            return {
                question: `${num1} × ${num2}`,
                answer: (num1 * num2).toString()
            };
        }
    },

    // Multiplication 6-9 tables
    multiplication6to9: {
        name: 'Multiplikasjon 6-9',
        category: 'multiplication',
        generate: () => {
            const num1 = Phaser.Math.Between(6, 9);
            const num2 = Phaser.Math.Between(1, 10);
            return {
                question: `${num1} × ${num2}`,
                answer: (num1 * num2).toString()
            };
        }
    },

    // Place value - ones place (einarplassen)
    placeValueOnes: {
        name: 'Einarplassen',
        category: 'placeValue',
        generate: () => {
            const number = Phaser.Math.Between(10, 9999);
            const onesDigit = number % 10;
            return {
                question: `Kva tal står på einarplassen?\n${number}`,
                answer: onesDigit.toString()
            };
        }
    },

    // Place value - tens place (tiarplass)
    placeValueTens: {
        name: 'Tiarplass (heiltal)',
        category: 'placeValue',
        generate: () => {
            const number = Phaser.Math.Between(10, 9999);
            const tensDigit = Math.floor((number / 10) % 10);
            return {
                question: `Kva tal står på tiarplass?\n${number}`,
                answer: tensDigit.toString()
            };
        }
    },

    // Place value - hundreds place (hundrarplass)
    placeValueHundreds: {
        name: 'Hundrarplass (heiltal)',
        category: 'placeValue',
        generate: () => {
            const number = Phaser.Math.Between(100, 9999);
            const hundredsDigit = Math.floor((number / 100) % 10);
            return {
                question: `Kva tal står på hundrarplass?\n${number}`,
                answer: hundredsDigit.toString()
            };
        }
    },

    // Place value - thousands place (tusenplass)
    placeValueThousands: {
        name: 'Tusenplass (heiltal)',
        category: 'placeValue',
        generate: () => {
            const number = Phaser.Math.Between(1000, 9999);
            const thousandsDigit = Math.floor(number / 1000);
            return {
                question: `Kva tal står på tusenplass?\n${number}`,
                answer: thousandsDigit.toString()
            };
        }
    },

    // Decimal place value - tenths (tidelar)
    decimalTenths: {
        name: 'Tidelsplassen (desimaltal)',
        category: 'decimal',
        generate: () => {
            const wholeNumber = Phaser.Math.Between(0, 99);
            const tenths = Phaser.Math.Between(1, 9);
            const decimalNumber = `${wholeNumber},${tenths}`;
            return {
                question: `Kva tal står på tidelsplassen?\n${decimalNumber}`,
                answer: tenths.toString()
            };
        }
    },

    // Decimal place value - hundredths (hundredelar)
    decimalHundredths: {
        name: 'Hundredelsplassen (desimaltal)',
        category: 'decimal',
        generate: () => {
            const wholeNumber = Phaser.Math.Between(0, 99);
            const tenths = Phaser.Math.Between(0, 9);
            const hundredths = Phaser.Math.Between(1, 9);
            const decimalNumber = `${wholeNumber},${tenths}${hundredths}`;
            return {
                question: `Kva tal står på hundredelsplassen?\n${decimalNumber}`,
                answer: hundredths.toString()
            };
        }
    },

    // Counting tenths - how many tidelar?
    countTenths: {
        name: 'Kor mange tidelar?',
        category: 'decimal',
        generate: () => {
            const wholeNumber = Phaser.Math.Between(0, 20);
            const tenths = Phaser.Math.Between(1, 9);
            const decimalNumber = `${wholeNumber},${tenths}`;
            return {
                question: `Kor mange tidelar er det i ${decimalNumber}?`,
                answer: tenths.toString()
            };
        }
    },

    // Counting hundredths - how many hundredelar?
    countHundredths: {
        name: 'Kor mange hundredelar?',
        category: 'decimal',
        generate: () => {
            const wholeNumber = Phaser.Math.Between(0, 20);
            const tenths = Phaser.Math.Between(0, 9);
            const hundredths = Phaser.Math.Between(1, 9);
            const decimalNumber = `${wholeNumber},${tenths}${hundredths}`;
            return {
                question: `Kor mange hundredelar er det i ${decimalNumber}?`,
                answer: hundredths.toString()
            };
        }
    },

    // Fraction to decimal - tenths (1/10 = 0,1)
    fractionToDecimalTenths: {
        name: 'Brøk til desimal (tidelar)',
        category: 'fractionDecimal',
        generate: () => {
            const numerator = Phaser.Math.Between(1, 9);
            const decimalAnswer = `0,${numerator}`;
            return {
                question: `${numerator}/10 =`,
                answer: decimalAnswer
            };
        }
    },

    // Fraction to decimal - hundredths (45/100 = 0,45)
    fractionToDecimalHundredths: {
        name: 'Brøk til desimal (hundredelar)',
        category: 'fractionDecimal',
        generate: () => {
            const numerator = Phaser.Math.Between(1, 99);
            const tenths = Math.floor(numerator / 10);
            const hundredths = numerator % 10;
            const decimalAnswer = `0,${tenths}${hundredths}`;
            return {
                question: `${numerator}/100 =`,
                answer: decimalAnswer
            };
        }
    },

    // Fraction to decimal - thousandths (804/1000 = 0,804)
    fractionToDecimalThousandths: {
        name: 'Brøk til desimal (tusendels)',
        category: 'fractionDecimal',
        generate: () => {
            const numerator = Phaser.Math.Between(1, 999);
            const hundreds = Math.floor(numerator / 100);
            const tens = Math.floor((numerator % 100) / 10);
            const ones = numerator % 10;
            const decimalAnswer = `0,${hundreds}${tens}${ones}`;
            return {
                question: `${numerator}/1000 =`,
                answer: decimalAnswer
            };
        }
    },

    // Decimal comparison - which is bigger?
    decimalComparison: {
        name: 'Samanlikning av desimaltal',
        category: 'decimalComparison',
        generate: () => {
            const patterns = [
                // Pattern 1: Different tenths (6,3 vs 6,35)
                () => {
                    const whole = Phaser.Math.Between(1, 20);
                    const tenths = Phaser.Math.Between(1, 8);
                    const num1 = `${whole},${tenths}`;
                    const num2 = `${whole},${tenths}${Phaser.Math.Between(1, 9)}`;
                    return { num1: num2, num2: num1, bigger: num2 }; // num2 is bigger
                },
                // Pattern 2: Trailing zeros (3,05 vs 3,050)
                () => {
                    const whole = Phaser.Math.Between(1, 20);
                    const tenths = Phaser.Math.Between(0, 9);
                    const hundredths = Phaser.Math.Between(1, 9);
                    const num1 = `${whole},${tenths}${hundredths}`;
                    const num2 = `${whole},${tenths}${hundredths}0`;
                    // They're equal, but we'll shuffle and return first
                    const nums = Phaser.Utils.Array.Shuffle([num1, num2]);
                    return { num1: nums[0], num2: nums[1], bigger: num1 };
                },
                // Pattern 3: Different values (2,480 vs 2,5)
                () => {
                    const whole = Phaser.Math.Between(1, 20);
                    const num1 = `${whole},${Phaser.Math.Between(4, 4)}${Phaser.Math.Between(8, 8)}0`;
                    const num2 = `${whole},${Phaser.Math.Between(5, 5)}`;
                    return { num1, num2, bigger: num2 }; // 2,5 > 2,480
                },
                // Pattern 4: Close comparison
                () => {
                    const whole = Phaser.Math.Between(1, 20);
                    const tenths1 = Phaser.Math.Between(1, 8);
                    const tenths2 = tenths1 + 1;
                    const num1 = `${whole},${tenths1}${Phaser.Math.Between(5, 9)}`;
                    const num2 = `${whole},${tenths2}`;
                    return { num1, num2, bigger: num2 };
                }
            ];

            const pattern = Phaser.Utils.Array.GetRandom(patterns);
            const result = pattern();

            return {
                question: `Kva tal er størst?\n${result.num1} eller ${result.num2}`,
                answer: result.bigger
            };
        }
    },

    // Decimal addition - tenths (0,3 + 0,4)
    decimalAdditionTenths: {
        name: 'Addisjon med tidelar',
        category: 'decimalArithmetic',
        generate: () => {
            const tenths1 = Phaser.Math.Between(1, 5);
            const tenths2 = Phaser.Math.Between(1, 5);
            const sum = tenths1 + tenths2;

            // If sum >= 10, it becomes 1,x
            if (sum >= 10) {
                const whole = 1;
                const remainder = sum - 10;
                return {
                    question: `0,${tenths1} + 0,${tenths2} =`,
                    answer: `${whole},${remainder}`
                };
            } else {
                return {
                    question: `0,${tenths1} + 0,${tenths2} =`,
                    answer: `0,${sum}`
                };
            }
        }
    },

    // Decimal addition - hundredths (0,23 + 0,45)
    decimalAdditionHundredths: {
        name: 'Addisjon med hundredelar',
        category: 'decimalArithmetic',
        generate: () => {
            const num1 = Phaser.Math.Between(11, 49);
            const num2 = Phaser.Math.Between(11, 49);
            const sum = num1 + num2;

            const tenths1 = Math.floor(num1 / 10);
            const hundredths1 = num1 % 10;
            const tenths2 = Math.floor(num2 / 10);
            const hundredths2 = num2 % 10;

            // Format answer
            if (sum >= 100) {
                const whole = 1;
                const remainder = sum - 100;
                const t = Math.floor(remainder / 10);
                const h = remainder % 10;
                return {
                    question: `0,${tenths1}${hundredths1} + 0,${tenths2}${hundredths2} =`,
                    answer: `${whole},${t}${h}`
                };
            } else {
                const t = Math.floor(sum / 10);
                const h = sum % 10;
                return {
                    question: `0,${tenths1}${hundredths1} + 0,${tenths2}${hundredths2} =`,
                    answer: `0,${t}${h}`
                };
            }
        }
    },

    // Decimal addition - mixed (2,3 + 1,5)
    decimalAdditionMixed: {
        name: 'Addisjon med desimaltal',
        category: 'decimalArithmetic',
        generate: () => {
            const whole1 = Phaser.Math.Between(1, 9);
            const whole2 = Phaser.Math.Between(1, 9);
            const tenths1 = Phaser.Math.Between(1, 9);
            const tenths2 = Phaser.Math.Between(1, 9);

            const totalTenths = tenths1 + tenths2;
            const carryOver = Math.floor(totalTenths / 10);
            const remainingTenths = totalTenths % 10;
            const totalWhole = whole1 + whole2 + carryOver;

            return {
                question: `${whole1},${tenths1} + ${whole2},${tenths2} =`,
                answer: `${totalWhole},${remainingTenths}`
            };
        }
    }
};
