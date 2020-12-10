require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const multer = require('multer')
const AWS = require('aws-sdk')
const multerS3 = require('multer-s3')
const imageType = require('image-type')
const fs = require('fs')
const cors = require('cors')
const path = require('path')
const mysql = require("mysql2/promise")

const multipart = multer({dest: path.join(__dirname, 'uploads')})

const app = express()
app.use(cors())
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));

const pool = mysql.createPool({
    host: process.env.MYSQL_SERVER,
    port: process.env.MYSQL_SVR_PORT,
	user: process.env.MYSQL_USERNAME,
	password: process.env.MYSQL_PASSWORD,
	database: process.env.MYSQL_SCHEMA,
	connectionLimit: process.env.MYSQL_CON_LIMIT,
})

const SQL_UPLOADIMG = `UPDATE guests SET guest_image = ? WHERE id = ?`
const SQL_DOWNLOADIMG = `SELECT guest_image FROM guests WHERE id = 1`

app.post('/db/upload/array', multipart.array("imgFile",2), (req,res)=> {

    const pathArray = []
    const uploadFileOne = path.join(__dirname, "uploads", req.files[0].filename)
    const uploadFileTwo = path.join(__dirname, "uploads", req.files[1].filename)
    pathArray.push(uploadFileOne, uploadFileTwo)
    const readFilePromise = function(file){
        return new Promise(function(resolve,reject){
            fs.readFile(file, function(err, data){
                if (err){
                    reject(err)
                }else {
                resolve(data)
                }
            })
        })
    }
    Promise.all([readFilePromise(pathArray[0]), readFilePromise(pathArray[1])])
        .then(([d1,d2]) => {
            console.log(d1)
            console.log(d2)
            conn.query(SQL_UPLOADIMG)
        })
    // pathArray.forEach(p => {
    //     fs.readFile(p, (err, imgFile)=> {
    //         console.log(imgFile)
    //         readFileDataArray.push(imgFile)
    //     })
    // })
    // console.log(readFileDataArray)
 
    //  pathArray.forEach((p, i) => {
    //     fs.readFile(p, async(err, imgFile)=> {
    //         const conn = await pool.getConnection()
    //     try{
    //         if (err) throw err
    //         console.log(i+1)
    //        const response = await conn.query(SQL_UPLOADIMG, [imgFile, i+1])
    //        console.log(response)
     
    //     } catch(e){
    //         console.log(e)
    //     }finally {
    //         conn.release()
    //     }
    //     })
     
    // })
    res.status(201).json({message: 'saved'})
  
    // fs.readFile(uploadFile, async(err, imgFile)=> {
    //     console.log(imgFile)
    //     const conn = await pool.getConnection()
    //     try{
    //         if (err) throw err
    //        const response = await conn.query(SQL_UPLOADIMG, [imgFile])
    //        console.log(response)
    //        res.status(201).json({message: 'saved'})
    //     } catch(e){
    //         console.log(e)
    //     }finally {
    //         conn.release()
    //     }
    // })

})
app.post('/db/upload', multipart.single("imgFile"),(req,res)=> {
    console.log("originalname:",req.file.originalname)
    console.log("mimetype:",req.file.mimetype)
    console.log("filename:",req.file.filename)
    console.log("path:", req.file.path)
    console.log("size:", req.file.size)
    console.log("comment", req.body.notes)

    const uploadFile = path.join(__dirname, "uploads", req.file.filename)
    fs.readFile(uploadFile, async(err, imgFile)=> {
        console.log(imgFile)
        const conn = await pool.getConnection()
        try{
            if (err) throw err
           const response = await conn.query(SQL_UPLOADIMG, [imgFile])
           console.log(response)
           res.status(201).json({message: 'saved'})
        } catch(e){
            console.log(e)
        }finally {
            conn.release()
        }
    })
})


app.get('/db/download' ,async(req,res)=> {
    const conn = await pool.getConnection()
    try{
        const [results, _ ]= await conn.query(SQL_DOWNLOADIMG)

        if (results.length > 0){
            res.status(200)
            //converts utf to img 
            res.type(imageType(results[0].guest_image).mime)
            res.send(results[0].guest_image)
        } else {
            res.status(404)
            res.end()
        }
        
    }catch(e){
        console.log(e)
    }finally{
        conn.release()
    }
})






const APP_PORT = process.env.APP_PORT
const AWS_S3_HOSTNAME = process.env.AWS_S3_HOSTNAME
const AWS_S3_ACCESS_KEY = process.env.AWS_S3_
const AWS_S3_SECRET_ACCESSKEY = process.env.AWS_S3_SECRET_ACCESSKEY
const AWS_S3_BUCKETNAME = process.env.AWS_S3_BUCKETNAME

const spaceEndPoint = new AWS.Endpoint(AWS_S3_HOSTNAME)

const s3 = new AWS.S3({
    endpoint: spaceEndPoint,
    accessKeyId: AWS_S3_ACCESS_KEY,
    secretAccessKey: AWS_S3_SECRET_ACCESSKEY,
})

const upload = multer({
    storage: multerS3({
        s3:s3,
        bucket: AWS_S3_BUCKETNAME,
        acl: 'public-read',
        metadata: function(req,file,cb){
            console.log(req.file)
            cb(null,{
                fileName: file.fieldname,
                originalFile: file.originalname,
                uploadDatetime: new Date().toString(),
                uploaded: req.query.uploader, //req.body.uploader
                note: req.query.note //req.body.note
            })
        },
        key: function(requests, file, cb){
            console.log(file)
            //fill up filename
            cb(null, new Date().getTime() + '_' + file.originalname)
        }
    }),
    
}).array('upload',1) //this is same as "image-file in single('image-file')"
//.single('upload')       for single file upload
app.post('/upload', (req,res,next)=> {
    upload(req,res, (error)=> {
        if (error){
            console.log(error)
            res.status(500).json(error)
        } 
    
        console.log('file successfully uploaded')
        res.status(200).json({message:'uploaded'})
    })
})



app.post('/upload2', multipart.single("image-file"), (req,res)=> {
    fs.readFile(req.file.path, (err, imgFile)=> {
        if (err) console.log(err)
        const params = {
            Bucket: AWS_S3_BUCKETNAME,
            Key: req.file.filename,
            Body: imgFile,
            ACL: 'public-read',
            Metadata: {
                originalName: req.file.originalname,
                update: ''+ (new Date()).getTime(),
                uploadDatetime: new Date().toString(),
                uploaded: req.query.uploader, //req.body.uploader
                note: req.query.note //req.body.note

            }
        }

        
        s3.putObject(params, (error, result)=> {
            return res.status(200)
                .type('application/json')
                .json({'key': process.env.BASE_URL+req.file.filename})
        })
        
    })
  
})

app.get('/download2/:key', (req,res)=> {
    const keyFileName = req.params.key  
    const params = {
        Bucket: AWS_S3_BUCKETNAME,
        Key: keyFileName
    }
    s3.getObject(params, (err, result)=> {
        if (err) console.log(err)
        let fileData= result.Body.toString('utf-8');
        res.status(200).send(fileData)
    })
})


const startApp = async (app, pool) => {
    const conn = await pool.getConnection()
    try{
        console.log('pinging database')
        await conn.ping()
        app.listen(APP_PORT, ()=> {
            console.log(`${APP_PORT} started`)
        })
    }catch(e){
        console.log(e)
    }finally{
        conn.release()
    }
}

app.use((req,res)=> {
    res.redirect('/')
})
startApp(app,pool)