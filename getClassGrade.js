const axios = require('axios');
const fs = require('fs');
const SocksProxyAgent = require('socks-proxy-agent');

let conf = {
    "site": "", // 教务系统地址
    "xh": "", // 查询人的学号，用于获取 token
    "password": "", // 查询人的密码
    "proxy": "", // 支持 Socks4 和 Socks5 代理 
    "xnxqid": "", // 学年学期
    "class": [], // 班级，为学号去除最后两位
    "student": [], // 要查询的学号，可以与班级同时填写
    "studentperclass": 30 // 每个班级的人数
}


const subject_api_sample = {
    xm: '', // 姓名
    kcmc: '', // 课程名称
    zcj: '', // 成绩
    kclbmc: '', // 课程属性
    xf: 0,  // 学分
    xqmc: '',   // 学期名称
    kcxzmc: '', // 课程性质
    ksxzmc: '', // 考核方式
    kcywmc: '', // 课程英文名称
};

const rows = [
    ['学号', '姓名', '课程名称', '成绩', '课程属性', '学分', '学期名称', '课程性质', '考核方式', '课程英文名称']
];

let agent = undefined;

// 开始
async function begin() {
    await readLocalFile('config.json')
        .then(async (data) => {
            conf = data;
            if (conf.proxy !== '')
                agent = new SocksProxyAgent(conf.proxy);
            const token = await apiLogin().catch(err=>console.log(`ERROR: 登录失败 ${err}`));
            await Promise.all(conf.class.map(async (c) => {
                for (let i = 1; i <= conf.studentperclass; i++)
                    await checkFromApi(c + ('0' + i).slice(-2), token).catch(err => console.log(err));
            }))
            await Promise.all(conf.student.map(async (s) => {
                await checkFromApi(s, token).catch(err => console.log(err));
            }))
            writeCSV();
        })
        .catch(err => console.log(`ERROR: conf.json 文件不存在或格式不正确\n${err}`));
}

// 查询单人成绩
function checkFromApi(xh, token) {
    return new Promise(async (resolve, reject) => {
        axios({
            url: `http://${conf.site}//app.do?xh=${xh}&xnxqid=${conf.xnxqid}&method=getCjcx`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Winsdows NT 10.0; Win64; x64; rv:79.0) Gecko/20100101 Firefox/79.0',
                'token': token
            },
            timeout: 1000,
            httpAgent: agent
        })
            .then((res) => {
                if (JSON.stringify(res.data[0]) === 'null') reject(`WARN: 无数据 ${xh}`);
                for (const j in res.data) {
                    const row = new Array();
                    row.push(xh);
                    for (const i in subject_api_sample)  // 一条记录
                        row.push(res.data[j][i]);
                    rows.push(row);
                }
                resolve();
            })
            .catch(err => reject(`ERROR: 查询失败 ${xh} ${err}`));
    })
}

// api 登录
function apiLogin() {
    return new Promise((resolve, reject) => {
        axios({
            url: `http://${conf.site}/app.do?method=authUser&xh=${conf.xh}&pwd=${conf.password}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Winsdows NT 10.0; Win64; x64; rv:79.0) Gecko/20100101 Firefox/79.0',
            },
            timeout: 1000,
            httpAgent: agent
        }).then((res) => {
            token = res.data.token;
            if (token === '-1')
                reject(res.data.msg);
            else
                resolve(token);
        }).catch(err => reject(err));
    });
}

// 写入 CSV 文件
function writeCSV() {
    let csvContent = '\uFEFF';
    csvContent = csvContent.concat(rows.map(e => e.join(",")).join("\n"));
    fs.writeFileSync('ClassGrade.csv', csvContent);
    console.log('查询完成');
}

// 读取 json 文件
function readLocalFile(filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, 'utf8', (err, data) => {
            if (err) reject(err);
            try {
                let obj = JSON.parse(data);
                resolve(obj);
            } catch (e) {
                reject(e);
            }
        });
    });
}

begin();