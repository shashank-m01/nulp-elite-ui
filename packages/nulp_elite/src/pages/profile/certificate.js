import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Footer from "components/Footer";
import Header from "components/header";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import SimCardDownloadOutlinedIcon from "@mui/icons-material/SimCardDownloadOutlined";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import Card from "@mui/material/Card";
import FloatingChatIcon from "../../components/FloatingChatIcon";
import * as util from "../../services/utilService";
import axios from "axios";
import NoResult from "pages/content/noResultFound";
import Alert from "@mui/material/Alert";
import ToasterCommon from "../ToasterCommon";
import { useNavigate } from "react-router-dom";
import html2pdf from "html2pdf.js";
const routeConfig = require("../../configs/routeConfig.json");
import { Loading } from "@shiksha/common-lib";

const getCertTimestamp = (cert) => {
  const issuedOn = cert?.osCreatedAt || cert?.issuer?.osUpdatedAt;
  return issuedOn ? new Date(issuedOn).getTime() : 0;
};

const getLatestCertificates = (certificates) => {
  const certList = Array.isArray(certificates)
    ? certificates
    : certificates?.result?.response?.content ||
      certificates?.result?.certificates ||
      certificates?.certificates ||
      [];
  const latestByKey = new Map();
  certList.forEach((cert) => {
    const key = cert?.training?.id || cert?.training?.name || cert?.osid;
    if (!key) return;
    const timestamp = getCertTimestamp(cert);
    const current = latestByKey.get(key);
    if (!current || timestamp >= current.timestamp) {
      latestByKey.set(key, { timestamp, cert });
    }
  });
  return certList
    .filter((cert) => {
      const key = cert?.training?.id || cert?.training?.name || cert?.osid;
      return key ? latestByKey.get(key)?.cert === cert : true;
    })
    .sort((a, b) => getCertTimestamp(b) - getCertTimestamp(a));
};

const Certificate = () => {
  const { t } = useTranslation();
  const [certData, setCertData] = useState(null);
  const [otherCertData, setOtherCertData] = useState([]);
  const [error, setError] = useState(null);
  const urlConfig = require("../../configs/urlConfig.json");
  const [toasterOpen, setToasterOpen] = useState(false);
  const [toasterMessage, setToasterMessage] = useState("");
  const navigate = useNavigate();
  const [svgData, setSvgData] = useState("");
  const [showSvgContainer, setShowSvgContainer] = useState(false);
  const svgContainerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  const showErrorMessage = (msg) => {
    setToasterMessage(msg);
    setTimeout(() => {
      setToasterMessage("");
    }, 2000);
    setToasterOpen(true);
  };

  useEffect(() => {
    setIsLoading(true);
    const fetchData = async () => {
      setError(null);
      try {
        const _userId = util.userId();
        const request = {
          request: {
            _source: [
              "data.badge.issuer.name",
              "pdfUrl",
              "data.issuedOn",
              "data.badge.name",
            ],
            query: {
              bool: {
                must: [
                  {
                    match_phrase: {
                      "recipient.id": _userId,
                    },
                  },
                ],
              },
            },
          },
        };
        const url = `${urlConfig.URLS.LEARNER_PREFIX}${urlConfig.URLS.CERTIFICATE.CERT_SEARCH}`;
        const response = await axios.post(url, request);
        const data = response.data;
        if (data?.result?.response?.content) {
          data.result.response.content.sort((a, b) => {
            const dateA = new Date(a?._source?.data?.issuedOn || 0).getTime();
            const dateB = new Date(b?._source?.data?.issuedOn || 0).getTime();
            return dateB - dateA;
          });
        }
        setCertData(data);
      } catch (error) {
        console.error("Error fetching user data:", error);
        showErrorMessage(t("FAILED_TO_FETCH_DATA"));
      }
      finally {
        setIsLoading(false);
      }

      try {
        setIsLoading(true);
        const _userId = util.userId();
        const request = {
          filters: {
            recipient: { id: { eq: _userId } },
          },
        };
        const url = `${urlConfig.URLS.LEARNER_PREFIX}${urlConfig.URLS.CERTIFICATE.CERTIF_SEARCH}`;
        const response = await axios.post(url, request);
        const data = response.data;

        setOtherCertData(getLatestCertificates(data));
      } catch (error) {
        console.error("Error fetching user data:", error);
        showErrorMessage(t("FAILED_TO_FETCH_DATA"));
      }
      finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getCertificate = async (template, osid, certificateName) => {
    setError(null);
    try {
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: `${urlConfig.URLS.LEARNER_PREFIX}${urlConfig.URLS.USER.DOWNLOAD_CERTIFICATE}/${osid}`,
        withCredentials: true,
        headers: {
          Accept: "image/svg+xml",
          "Content-Type": "application/json, text/plain",
          template: template,
        },
      };

      const response = await axios.request(config);
      if (response.data) {
        setSvgData(response.data);
        setShowSvgContainer(true); // Show SVG container before downloading
        await handleDownloadPdf(certificateName);
        setShowSvgContainer(false); // Hide SVG container after downloading
      }
    } catch (error) {
      console.error("Error fetching user certificate:", error);
      showErrorMessage(t("FAILED_TO_FETCH_DATA"));
    }
  };
  const getCertificateReport = async (id, certificateName) => {
    setError(null);
    try {
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: `${urlConfig.URLS.LEARNER_PREFIX}${urlConfig.URLS.USER.DOWNLOAD_CERTIFICATE_REPORT}/${id}`,
        withCredentials: true,
        headers: {
          Accept: "image/svg+xml",
          "Content-Type": "application/json, text/plain",
        },
      };

      const response = await axios.request(config);
      if (response.data) {
        setSvgData(response.data.result.printUri);
        setShowSvgContainer(true); // Show SVG container before downloading
        await handleDownloadPdf(certificateName);
        setShowSvgContainer(false); // Hide SVG container after downloading
      }
    } catch (error) {
      console.error("Error fetching user certificate:", error);
      showErrorMessage(t("FAILED_TO_FETCH_DATA"));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return "Not Provided";
    }
    
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return "Not Provided";
    }
    
    const options = { day: "2-digit", month: "long", year: "numeric" };
    return date.toLocaleDateString("en-GB", options);
  };
  const handleGoBack = () => {
    navigate(-1);
  };
  useEffect(() => {
    if (svgData.startsWith("data:image/svg+xml,")) {
      const encodedSvg = svgData.slice("data:image/svg+xml,".length);
      const decodedSvgContent = decodeURIComponent(encodedSvg);
      setSvgData(decodedSvgContent);
    }
  }, [svgData]);

  const handleDownloadPdf = async (certificateName) => {
    const element = svgContainerRef.current;

    if (element) {
      const opt = {
        margin: 0,
        filename: `${certificateName}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "letter", orientation: "landscape" },
      };

      html2pdf().set(opt).from(element).save();
    }
  };
  return (
    <div>
      <Box className="lg-hide">
        <Header />
      </Box>
      <Box>
      {toasterMessage && <ToasterCommon response={toasterMessage} />}
      <Container
        maxWidth="xxl"
        role="main"
        className="container-pb mb-20  xs-pb-75 lg-mt-12"
      >
        {error && (
          <Alert severity="error" className="my-10">
            {error}
          </Alert>
        )}
        <Box textAlign="center" padding="10" className="xs-pt-15">
          <Box
            sx={{ fontSize: "18px", color: "#484848" }}
            className="lg-hide text-left my-15"
          >
            {t("MY_PROFILE")}
          </Box>
          <Box className="d-flex jc-bw alignItems-center mb-20">
            <Box style={{ display: "flex", alignItems: "end" }}>
              <ReceiptLongIcon style={{ paddingRight: "10px" }} />{" "}
              {t("DOWNLOAD_CERTIFICATES")}
            </Box>
            <Link
              type="button"
              href={routeConfig.ROUTES.POFILE_PAGE.PROFILE}
              className="viewAll xs-cert-btn "
            // onClick={handleGoBack}
            >
              {t("BACK_TO_LEARNNG")}
            </Link>
          </Box>
          <Card
            className="xs-mt-15 pb-20 custom-pb-20"
            style={{
              textAlign: "left",
              borderRadius: "10px",
            }}
          >
            <Grid
              container
              spacing={2}
              className="certificate"
              style={{ textAlign: "left" }}
            >
              {(!certData || certData.result.response.content.length === 0) &&
                otherCertData.length === 0 && !isLoading ? (
                <NoResult />
              ) : (
                  <>
                    {isLoading ? (
                      <Box className="p-15">
                      <Loading message={t("LOADING")} />
                      </Box>
                    ) : (
                      <>
                        {certData &&
                          certData.result.response.content &&
                          certData.result.response.content.map((certificate) => (
                            <Grid item xs={12} md={4} key={certificate._id}>
                              <Card
                                sx={{
                                  marginTop: "10px",
                                  padding: "10px",
                                  borderRadius: "10px",
                                  border: "solid 1px #EFEFEF",
                                  boxShadow: "none",
                                  color: "#484848",
                                }}
                              >
                                <Typography
                                  className="twoLineEllipsis"
                                  variant="subtitle1"
                                  color="text.secondary"
                                  component="div"
                                  style={{
                                    fontSize: "14px",
                                    paddingBottom: "0",
                                    height: "42px",
                                    fontWeight: "600",
                                  }}
                                >
                                  {certificate?._source?.data?.badge?.name}
                                </Typography>
                                <Typography
                                  variant="subtitle1"
                                  color="text.secondary"
                                  component="div"
                                  style={{ fontSize: "12px" }}
                                >
                                  {t("CERTIFICATE_GIVEN_BY")}:{" "}
                                  {certificate?._source?.data?.badge?.issuer?.name}
                                </Typography>
                                <Typography
                                  variant="subtitle1"
                                  color="text.secondary"
                                  component="div"
                                  style={{ fontSize: "12px" }}
                                >
                                  {t("CERTIFICATE_ISSUE_DATE")}:{" "}
                                  {formatDate(certificate?._source?.data?.issuedOn)}
                                </Typography>
                                <Box
                                  style={{
                                    display: "flex",
                                    alignItems: "end",
                                    color: "#1976d2",
                                    cursor: "pointer",
                                  }}
                                  className="text-green"
                                >
                                  <SimCardDownloadOutlinedIcon />
                                  <Link
                                    href={certificate?._source?.pdfUrl}
                                    underline="none"
                                    style={{
                                      fontSize: "12px",
                                      marginTop: "15px",
                                      display: "block",
                                    }}
                                    onClick={() => {
                                      getCertificateReport(
                                        certificate?._id,
                                        certificate?._source?.data?.badge?.name
                                      );
                                    }}
                                  >
                                    {t("CERTIFICATES")}
                                  </Link>
                                </Box>
                              </Card>
                            </Grid>
                          ))}
                        {otherCertData.map((certificate) => (
                          <Grid item xs={12} md={4} key={certificate?.osid}>
                            <Card
                              sx={{
                                marginTop: "10px",
                                padding: "10px",
                                borderRadius: "10px",
                                border: "solid 1px #EFEFEF",
                                boxShadow: "none",
                                color: "#484848",
                                position: 'relative',
                              }}
                            >
                              {certificate?.training?.type && (
                                <Typography
                                  gutterBottom
                                  variant="h7"
                                  component="div"
                                  className="ribbonCard"
                                  marginTop={"-23px"}
                                >
                                  <Box className="cardCourses">{certificate?.training?.type}</Box>
                                </Typography>
                              )}

                              <Typography
                                className="twoLineEllipsis"
                                variant="subtitle1"
                                color="text.secondary"
                                component="div"
                                style={{
                                  fontSize: "14px",
                                  paddingBottom: "0",
                                  height: "42px",
                                  fontWeight: "600",
                                  marginTop : "27px"
                                }}
                              >
                                {certificate?.training?.name}
                              </Typography>
                              <Typography
                                variant="subtitle1"
                                color="text.secondary"
                                component="div"
                                style={{ fontSize: "12px" }}
                              >
                                {t("CERTIFICATE_GIVEN_BY")}: {certificate?.issuer?.name}
                              </Typography>
                              <Typography
                                variant="subtitle1"
                                color="text.secondary"
                                component="div"
                                style={{ fontSize: "12px" }}
                              >
                                {t("CERTIFICATE_ISSUE_DATE")}:{" "}
                                {formatDate(certificate?.osCreatedAt)}
                              </Typography>
                              <Box
                                style={{
                                  display: "flex",
                                  alignItems: "end",
                                  color: "#1976d2",
                                  cursor: "pointer",
                                }}
                                className="text-green"
                                onClick={() => {
                                  getCertificate(
                                    certificate?.templateUrl,
                                    certificate?.osid,
                                    certificate?.training?.name
                                  );
                                }}
                              >
                                <SimCardDownloadOutlinedIcon />
                                <Link
                                  href={certificate?.pdfUrl}
                                  underline="none"
                                  style={{
                                    fontSize: "12px",
                                    marginTop: "15px",
                                    display: "block",
                                  }}
                                >
                                  {t("CERTIFICATES")}
                                </Link>
                              </Box>
                            </Card>
                          </Grid>
                        ))}
                      </>
                    )}
                  </>
              )}
            </Grid>
          </Card>
        </Box>
        {showSvgContainer && (
          <div
            ref={svgContainerRef}
            dangerouslySetInnerHTML={{ __html: svgData }}
          />
        )}
      </Container>
      <FloatingChatIcon />
      </Box>
      <Box className="lg-hide">
        <Footer />
      </Box>
    </div>
  );
};

export default Certificate;
