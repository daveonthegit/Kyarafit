from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import os
import uuid
from PIL import Image
import io
from rembg import remove
import aiofiles
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Kyarafit Image Service",
    description="AI-powered image processing for cosplay wardrobe management",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory
UPLOAD_DIR = "uploads"
PROCESSED_DIR = "processed"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "kyarafit-image-service"}

@app.post("/process/remove-background")
async def remove_background(
    file: UploadFile = File(...),
    model: str = "u2net"
):
    """
    Remove background from uploaded image using rembg
    
    Args:
        file: Image file to process
        model: rembg model to use (u2net, u2netp, u2net_human_seg, etc.)
    
    Returns:
        Processed image with background removed
    """
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}_input.jpg")
        output_path = os.path.join(PROCESSED_DIR, f"{file_id}_processed.png")
        
        # Save uploaded file
        async with aiofiles.open(input_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Process image with rembg
        with open(input_path, 'rb') as input_file:
            input_data = input_file.read()
        
        # Remove background
        output_data = remove(input_data, model=model)
        
        # Save processed image
        with open(output_path, 'wb') as output_file:
            output_file.write(output_data)
        
        # Clean up input file
        os.remove(input_path)
        
        logger.info(f"Processed image {file_id} with model {model}")
        
        return FileResponse(
            output_path,
            media_type="image/png",
            filename=f"{file_id}_processed.png"
        )
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@app.post("/process/segment")
async def segment_image(
    file: UploadFile = File(...),
    model: str = "u2net"
):
    """
    Segment image to identify different parts/objects
    
    Args:
        file: Image file to process
        model: Segmentation model to use
    
    Returns:
        Segmented image with different parts highlighted
    """
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}_input.jpg")
        output_path = os.path.join(PROCESSED_DIR, f"{file_id}_segmented.png")
        
        # Save uploaded file
        async with aiofiles.open(input_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Process image with rembg for segmentation
        with open(input_path, 'rb') as input_file:
            input_data = input_file.read()
        
        # Segment image
        output_data = remove(input_data, model=model)
        
        # Save segmented image
        with open(output_path, 'wb') as output_file:
            output_file.write(output_data)
        
        # Clean up input file
        os.remove(input_path)
        
        logger.info(f"Segmented image {file_id} with model {model}")
        
        return FileResponse(
            output_path,
            media_type="image/png",
            filename=f"{file_id}_segmented.png"
        )
        
    except Exception as e:
        logger.error(f"Error segmenting image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error segmenting image: {str(e)}")

@app.get("/models")
async def list_models():
    """List available rembg models"""
    models = [
        "u2net",
        "u2netp", 
        "u2net_human_seg",
        "u2net_cloth_seg",
        "silueta",
        "isnet-general-use"
    ]
    return {"models": models}

@app.delete("/cleanup")
async def cleanup_files():
    """Clean up old processed files (for maintenance)"""
    try:
        import time
        current_time = time.time()
        cleaned_count = 0
        
        # Clean files older than 1 hour
        for directory in [UPLOAD_DIR, PROCESSED_DIR]:
            for filename in os.listdir(directory):
                file_path = os.path.join(directory, filename)
                if os.path.isfile(file_path):
                    file_age = current_time - os.path.getmtime(file_path)
                    if file_age > 3600:  # 1 hour
                        os.remove(file_path)
                        cleaned_count += 1
        
        return {"message": f"Cleaned up {cleaned_count} files"}
        
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True
    )
