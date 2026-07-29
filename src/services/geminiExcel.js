import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export async function extractExcelWithGemini(rows) {
  try {
    const prompt = `
You are an inventory extraction AI.

The following JSON was extracted from an Excel spreadsheet.

Your job is to identify the inventory items regardless of what the column names are.

Possible column names include:

Item
Item Name
Material
Material Description
Description
Product
Product Name

Quantity
Qty
Received Qty
Received Quantity
Stock
Units

Unit
UOM
Measurement
Unit Of Measure

Ignore columns like:

GST
Price
Rate
Amount
Vendor
Supplier
Invoice Number
Invoice Date
HSN
Remarks

Return ONLY valid JSON.

The output format MUST be:

[
  {
    "name": "PVC Pipe",
    "qty": 50,
    "unit": "pcs"
  }
]

Rules:

1. qty must always be a number.
2. unit must always exist.
3. If unit is missing use "pcs".
4. Do NOT include explanations.
5. Do NOT wrap JSON inside markdown.
6. Return ONLY the JSON array.

Excel Data:

${JSON.stringify(rows)}
`;

    const result = await model.generateContent(prompt);

    const response = await result.response;

    let text = response.text();

    // Remove markdown if Gemini adds it anyway
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const items = JSON.parse(text);

    return items.map((item, index) => ({
      id: index + 1,
      name: item.name ?? "",
      qty: Number(item.qty ?? 0),
      unit: item.unit ?? "pcs",
    }));
  } catch (err) {
    console.error(err);
    throw new Error("Unable to process Excel using Gemini.");
  }
}