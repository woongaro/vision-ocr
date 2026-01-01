from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pytesseract
from PIL import Image
import io
import os
from pdf2image import convert_from_bytes
import shutil

app = FastAPI(title="OCR API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    filename = file.filename.lower()
    content = await file.read()
    
    extracted_text = ""
    
    try:
        if filename.endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
            image = Image.open(io.BytesIO(content))
            extracted_text = pytesseract.image_to_string(image, lang='kor+eng')
            
        elif filename.endswith('.pdf'):
            # PDF를 이미지로 변환 (각 페이지마다 OCR 수행)
            images = convert_from_bytes(content)
            for i, image in enumerate(images):
                page_text = pytesseract.image_to_string(image, lang='kor+eng')
                extracted_text += f"--- Page {i+1} ---\n{page_text}\n"
        
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
            
        return {"filename": file.filename, "text": extracted_text.strip()}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
