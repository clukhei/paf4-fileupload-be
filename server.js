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


const app = express()
app.use(cors())
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));


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
            console.log(file)
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

const multipart = multer({dest: path.join(__dirname, 'uploads')})

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
app.listen(APP_PORT, ()=> {
    console.log(`${APP_PORT} started`)
})